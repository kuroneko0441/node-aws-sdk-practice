import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as Lambda from 'lambdas';
import {
  generateZip,
  Logger,
} from 'lib';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as RxOp from 'rxjs/operators';

const LIBRARY_LAYER_NAME = 'nodejs-kuroneko0441';
const LIBRARY_LAYER_DESCRIPTION = 'Node.JS kuroneko0441 custom library';

export const deployLibrary = (): Rx.Observable<AWS.Lambda.PublishLayerVersionResponse> => {
  const lambdaConnector = new AWS.Lambda({
    region: 'ap-northeast-2',
  });

  const publishLayerVersion =
    Rx.bindNodeCallback<AWS.Lambda.Types.PublishLayerVersionRequest, AWS.Lambda.Types.PublishLayerVersionResponse>(
      lambdaConnector.publishLayerVersion.bind(lambdaConnector),
    );

  const libraryPath = path.join(__dirname, '../lib/');
  const libraryFilePath = path.join(__dirname, '../lib.zip');

  return Logger.fromObservable(
    generateZip(libraryFilePath, archive => archive.directory(libraryPath, 'nodejs/node_modules/lib/'))
      .pipe(
        RxOp.switchMap(zipFilePath => {
          return Logger.fromObservable(
            publishLayerVersion({
              LayerName: LIBRARY_LAYER_NAME,
              Description: LIBRARY_LAYER_DESCRIPTION,
              CompatibleRuntimes: [
                'nodejs8.10',
                'nodejs10.x',
                'nodejs12.x',
              ],
              Content: {
                ZipFile: fs.readFileSync(zipFilePath),
              },
            }),
            'Publishing new library layer version',
          );
        }),
      ),
    `Deploying library layer`,
  );
};

export const deployLambdas = () => {
  const lambdaConnector = new AWS.Lambda({
    region: 'ap-northeast-2',
  });

  const localLambdaFunctions = Object.keys(Lambda)
    .filter(key => typeof Lambda[key] === 'function');

  const listFunctions =
    Rx.bindNodeCallback<AWS.Lambda.Types.ListFunctionsRequest, AWS.Lambda.Types.ListFunctionsResponse>(
      lambdaConnector.listFunctions.bind(lambdaConnector),
    );

  const updateFunctionConfiguration =
    Rx.bindNodeCallback<AWS.Lambda.Types.UpdateFunctionConfigurationRequest, AWS.Lambda.Types.FunctionConfiguration>(
      lambdaConnector.updateFunctionConfiguration.bind(lambdaConnector),
    );

  const updateFunctionCode =
    Rx.bindNodeCallback<AWS.Lambda.Types.UpdateFunctionCodeRequest, AWS.Lambda.Types.FunctionConfiguration>(
      lambdaConnector.updateFunctionCode.bind(lambdaConnector),
    );

  const deployObservable = deployLibrary()
    .pipe(
      RxOp.share(),
    );

  Logger.fromObservable(
    Logger.fromObservable(listFunctions({}), 'Listing lambda functions')
      .pipe(
        RxOp.map(lambda => lambda.Functions || []),
        RxOp.tap(lambdas => Logger.debug(`Total ${lambdas.length} lambda functions found.`)),
        RxOp.mergeMap(lambdas => lambdas),
        RxOp.filter(lambda => lambda.FunctionName !== undefined && localLambdaFunctions.includes(lambda.FunctionName)),
        RxOp.mergeMap(functionConfiguration => {
          const lambdaName = functionConfiguration.FunctionName;
          const libraryPath = path.join(__dirname, `../lambdas/${lambdaName}.js`);
          const lambdaZipFilePath = path.join(__dirname, `../${lambdaName}.zip`);

          return Rx.combineLatest([
            Rx.of(functionConfiguration),
            deployObservable,
            generateZip(lambdaZipFilePath, archive => archive.file(libraryPath, { name: 'index.js' })),
          ]);
        }),
        RxOp.map(([ functionConfiguration, publishLayerVersionResponse, zipFilePath ]) => {
          return {
            functionConfiguration: functionConfiguration,
            publishLayerVersionResponse: publishLayerVersionResponse,
            zipFilePath: zipFilePath,
          };
        }),
        RxOp.mergeMap(({ functionConfiguration, publishLayerVersionResponse, zipFilePath }) => {
          const lambdaName = functionConfiguration.FunctionName;
          const newLayerArn = publishLayerVersionResponse.LayerArn;
          const newLayerVersionArn = publishLayerVersionResponse.LayerVersionArn;
          const lastLayerArns = (functionConfiguration.Layers || [])
            .map(layer => layer.Arn)
            .filter((arn): arn is string => arn !== undefined)
            .filter(arn => arn.replace(/:\d+$/, '') !== newLayerArn);

          return Rx.concat(
            Logger.fromObservable(
              updateFunctionCode({
                FunctionName: lambdaName!,
                ZipFile: fs.readFileSync(zipFilePath),
              }),
              `Updating code of '${lambdaName}'`,
            ),
            Logger.fromObservable(
              updateFunctionConfiguration({
                FunctionName: lambdaName!,
                Handler: `index.${lambdaName}`,
                Runtime: 'nodejs12.x',
                Layers: [
                  ...lastLayerArns,
                  newLayerVersionArn,
                ]
                  .filter((arn): arn is string => arn !== undefined),
              }),
              `Updating configuration of '${lambdaName}'`,
            ),
          );
        }),
        RxOp.toArray(),
      ),
    'Deploying lambda functions',
  )
    .subscribe();
};
