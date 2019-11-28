import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as RxOp from 'rxjs/operators';
import { Logger } from './Logger';

export const generateZip = (destPath: string, callback: (archive: archiver.Archiver) => archiver.Archiver): Rx.Observable<string> => {
  return Logger.fromObservable(
    new Rx.Observable<string>(subscriber => {
      const absoluteDestPath = path.isAbsolute(destPath) ? destPath : path.join(process.cwd(), destPath);
      Logger.debug(`Zip file path: ${absoluteDestPath}`);

      const archive = archiver('zip');
      archive.pipe(fs.createWriteStream(absoluteDestPath));
      callback(archive)
        .on('finish', () => {
          Logger.debug(`Zip file size: ${fs.statSync(absoluteDestPath).size} bytes.`);
          subscriber.next(absoluteDestPath);
          subscriber.complete();
        })
        .on('error', error => subscriber.error(error))
        .finalize();
    })
      .pipe(
        RxOp.delay(100),
      ),
    'Creating zip file',
  );
};
