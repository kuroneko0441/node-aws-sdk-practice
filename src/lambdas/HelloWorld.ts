import {
  Context,
  Logger,
} from 'lib';
import * as Rx from 'rxjs';

export const HelloWorld = (event: object, context: Context) => {
  Logger.fromObservable(Rx.of('Hello World!'), 'Printing Hello World')
    .subscribe(value => Logger.info(value));
};
