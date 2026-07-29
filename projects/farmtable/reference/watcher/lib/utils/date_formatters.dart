/// UI-04 (r1f.9): centralized timestamp formatting so views don't drift.
///
/// Previously issue_inspector used `YYYY-MM-DD HH:MM` and activity_ticker used
/// `MM/DD HH:MM`, each hand-rolled with padLeft. These two canonical formats now
/// live here. (Kept dependency-free — no `intl` — to preserve the exact existing
/// output and avoid adding a package.)
class DateFormatters {
  DateFormatters._();

  static String _two(int v) => v.toString().padLeft(2, '0');

  /// `YYYY-MM-DD HH:MM` — used in the issue inspector.
  static String full(DateTime date) =>
      '${date.year}-${_two(date.month)}-${_two(date.day)} '
      '${_two(date.hour)}:${_two(date.minute)}';

  /// `MM/DD HH:MM` — used in the compact activity ticker.
  static String short(DateTime date) =>
      '${_two(date.month)}/${_two(date.day)} '
      '${_two(date.hour)}:${_two(date.minute)}';
}
