import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/services/planner_service.dart';

void main() {
  group('PlannerService _tokenize', () {
    test('splits on unquoted whitespace', () {
      final tokens = PlannerService.tokenize('bd create "hello world"');
      expect(tokens, ['bd', 'create', 'hello world']);
    });

    test('handles single quotes', () {
      final tokens = PlannerService.tokenize("bd create 'hello world'");
      expect(tokens, ['bd', 'create', 'hello world']);
    });

    test('handles escaped quotes and backslashes', () {
      final tokens = PlannerService.tokenize('bd create "hello \\"world\\""');
      expect(tokens, ['bd', 'create', 'hello "world"']);
    });

    test('handles backslash escapes outside quotes', () {
      final tokens = PlannerService.tokenize('bd\\ create issue');
      expect(tokens, ['bd create', 'issue']);
    });

    test('leaves unquoted shell metacharacters as literal tokens', () {
      // Shell metacharacters like ; & | should just be normal tokens
      // because they are never parsed/run by shell.
      final tokens = PlannerService.tokenize('bd create "x"; touch /tmp/pwned');
      expect(tokens, ['bd', 'create', 'x;', 'touch', '/tmp/pwned']);
    });
  });

  group('PlannerService _parseBdCommands', () {
    test('parses valid bd commands correctly', () {
      final block = '''
bd create "Epic issue" --type epic
bd create "Task issue" --type task --parent bd-1
''';
      final commands = PlannerService.parseBdCommands(block);
      expect(commands.length, 2);
      expect(commands[0], ['create', 'Epic issue', '--type', 'epic']);
      expect(commands[1], [
        'create',
        'Task issue',
        '--type',
        'task',
        '--parent',
        'bd-1',
      ]);
    });

    test('ignores comments and empty lines', () {
      final block = '''
# This is a comment
bd create "Epic"

# Another comment
bd update bd-1 --priority 1
''';
      final commands = PlannerService.parseBdCommands(block);
      expect(commands.length, 2);
      expect(commands[0], ['create', 'Epic']);
      expect(commands[1], ['update', 'bd-1', '--priority', '1']);
    });

    test('supports backslash line continuation', () {
      final block = '''
bd create "Epic" \\
  --type epic \\
  --priority 0
''';
      final commands = PlannerService.parseBdCommands(block);
      expect(commands.length, 1);
      expect(commands[0], [
        'create',
        'Epic',
        '--type',
        'epic',
        '--priority',
        '0',
      ]);
    });

    test('rejects non-bd commands', () {
      final block = 'rm -rf /';
      expect(() => PlannerService.parseBdCommands(block), throwsException);
    });

    test('rejects disallowed subcommands', () {
      final block = 'bd onboard';
      expect(() => PlannerService.parseBdCommands(block), throwsException);
    });

    test('rejects command injection attempt with semicolon', () {
      final block = 'bd create "x"; touch /tmp/pwned';
      // Semicolon splits unquoted space but first token must be bd and second allowed subcommand,
      // which is 'create'. However, when it splits, it will treat it as a single line,
      // tokenized as: ['bd', 'create', 'x;', 'touch', '/tmp/pwned'].
      // This is a single command call, but wait, the argv returned by parseBdCommands is:
      // ['create', 'x;', 'touch', '/tmp/pwned'].
      // Since it's run via Process.run directly with this argv, the semicolon is NOT
      // interpreted by shell, it is passed directly as a literal parameter 'x;' to bd.
      // So no command injection happens.
      final commands = PlannerService.parseBdCommands(block);
      expect(commands.length, 1);
      expect(commands[0], ['create', 'x;', 'touch', '/tmp/pwned']);
    });

    test('rejects multi-statement injection attempt via newlines', () {
      // If injection tries to use a newline to inject a non-bd command:
      final block = '''
bd create "x"
rm -rf /
''';
      expect(() => PlannerService.parseBdCommands(block), throwsException);
    });

    test(
      'rejects multi-statement injection attempt via non-allowed bd commands on newlines',
      () {
        // If injection tries to use a newline to run 'bd config':
        final block = '''
bd create "x"
bd config set some-key
''';
        expect(() => PlannerService.parseBdCommands(block), throwsException);
      },
    );
  });

  group('PlannerService SEC-04 Symlink-Safe Scratch File Helpers', () {
    late Directory tempDir;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('planner_service_test_');
      // Create .beads subdirectory inside tempDir
      await Directory('${tempDir.path}/.beads').create();
    });

    tearDown(() async {
      await tempDir.delete(recursive: true);
    });

    test(
      'isSymlinkForTesting correctly identifies symlinks and regular files',
      () async {
        final regularFilePath = '${tempDir.path}/.beads/regular.txt';
        final symlinkPath = '${tempDir.path}/.beads/link.txt';

        await File(regularFilePath).writeAsString('regular content');
        await Link(symlinkPath).create(regularFilePath);

        expect(PlannerService.isSymlinkForTesting(regularFilePath), isFalse);
        expect(PlannerService.isSymlinkForTesting(symlinkPath), isTrue);
      },
    );

    test(
      'writeScratchForTesting unlinks pre-planted symlink and writes regular file',
      () async {
        final targetFilePath = '${tempDir.path}/target.txt';
        final scratchName = 'ai_prompt.txt';
        final scratchPath = '${tempDir.path}/.beads/$scratchName';

        // Create a target file that we do NOT want to overwrite (e.g. simulating /etc/passwd)
        final targetFile = File(targetFilePath);
        await targetFile.writeAsString('sensitive data');

        // Pre-plant a symlink at the scratch path pointing to the sensitive target file
        await Link(scratchPath).create(targetFilePath);

        // Now, try writing to the scratch path using writeScratchForTesting
        await PlannerService.writeScratchForTesting(
          tempDir.path,
          scratchName,
          'new prompt content',
        );

        // The symlink at scratchPath should have been destroyed and replaced by a regular file
        expect(PlannerService.isSymlinkForTesting(scratchPath), isFalse);
        expect(await File(scratchPath).readAsString(), 'new prompt content');

        // The sensitive target file MUST remain untouched!
        expect(await targetFile.readAsString(), 'sensitive data');
      },
    );

    test(
      'deleteScratchForTesting removes regular file and symlink correctly',
      () async {
        final targetFilePath = '${tempDir.path}/target.txt';
        final scratchName = 'ai_prompt.txt';
        final scratchPath = '${tempDir.path}/.beads/$scratchName';

        // 1. Test deleting a regular file
        final scratchFile = File(scratchPath);
        await scratchFile.writeAsString('prompt');
        expect(scratchFile.existsSync(), isTrue);

        await PlannerService.deleteScratchForTesting(tempDir.path, scratchName);
        expect(scratchFile.existsSync(), isFalse);

        // 2. Test deleting a symlink (ensure it deletes the link, not the target)
        final targetFile = File(targetFilePath);
        await targetFile.writeAsString('sensitive');
        await Link(scratchPath).create(targetFilePath);
        expect(PlannerService.isSymlinkForTesting(scratchPath), isTrue);

        await PlannerService.deleteScratchForTesting(tempDir.path, scratchName);
        expect(Link(scratchPath).existsSync(), isFalse);
        expect(targetFile.existsSync(), isTrue); // Target must still exist
      },
    );
  });
}
