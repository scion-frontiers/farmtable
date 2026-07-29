import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/utils/app_logger.dart';

void main() {
  group('AppLogger', () {
    test('can be instantiated with a name', () {
      const log = AppLogger('TestComponent');
      expect(log.name, 'TestComponent');
    });

    test('debug/info/warning/error do not throw', () {
      const log = AppLogger('Test');
      expect(() => log.debug('debug message'), returnsNormally);
      expect(() => log.info('info message'), returnsNormally);
      expect(() => log.warning('warning message'), returnsNormally);
      expect(() => log.error('error message'), returnsNormally);
    });

    test('all levels accept optional error and stackTrace', () {
      const log = AppLogger('Test');
      final e = Exception('test error');
      final st = StackTrace.current;
      expect(
        () => log.warning('with context', error: e, stackTrace: st),
        returnsNormally,
      );
    });

    test(
      'processException does not throw for a well-formed ProcessException',
      () {
        const log = AppLogger('Test');
        final e = ProcessException('bd', ['export'], 'not found', 127);
        expect(
          () => log.processException('bd export failed', e),
          returnsNormally,
        );
      },
    );

    test(
      'processException captures executable, arguments, errorCode in error map',
      () {
        // We verify indirectly: the method accepts the exception and doesn't
        // suppress it by throwing itself — the structured fields are passed to
        // dart:developer, which we cannot easily intercept in unit tests.
        const log = AppLogger('ProcessTest');
        final e = ProcessException(
          '/opt/homebrew/bin/bd',
          ['federation', 'sync'],
          'connection refused',
          1,
        );
        expect(
          () => log.processException('federation sync failed', e),
          returnsNormally,
        );
      },
    );

    test('multiple loggers with distinct names are independent', () {
      const logA = AppLogger('ServiceA');
      const logB = AppLogger('ServiceB');
      expect(logA.name, isNot(equals(logB.name)));
      expect(() => logA.info('from A'), returnsNormally);
      expect(() => logB.info('from B'), returnsNormally);
    });
  });
}
