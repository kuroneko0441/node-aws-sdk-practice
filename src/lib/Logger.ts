import * as Rx from 'rxjs';
import * as RxOp from 'rxjs/operators';

export class Logger {
  public static trace(message?: any, ...optionalParams: any[]): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    /* tslint:disable-next-line:no-console */
    console.trace('TRACE:', message, ...optionalParams);
  }

  public static debug(message?: any, ...optionalParams: any[]): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    /* tslint:disable-next-line:no-console */
    console.debug('DEBUG:', message, ...optionalParams);
  }

  public static info(message?: any, ...optionalParams: any[]): void {
    /* tslint:disable-next-line:no-console */
    console.info('INFO: ', message, ...optionalParams);
  }

  public static warn(message?: any, ...optionalParams: any[]): void {
    /* tslint:disable-next-line:no-console */
    console.warn('WARN: ', message, ...optionalParams);
  }

  public static error(message?: any, ...optionalParams: any[]): void {
    /* tslint:disable-next-line:no-console */
    console.error('ERROR:', message, ...optionalParams);
  }

  public static fromObservable<T>(observable: Rx.Observable<T>, title: string): Rx.Observable<T> {
    return Rx.of(null)
      .pipe(
        RxOp.tap(() => Logger.info(`${title}...`)),
        RxOp.switchMapTo(observable),
        RxOp.tap(() => Logger.info(`${title} finished.`)),
      );
  }
}
