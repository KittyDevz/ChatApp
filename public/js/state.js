/**
 * Shared mutable state for the entire frontend.
 * Import this object in any module that needs to read or write app state.
 */
export const state = {
  /** Active WebSocket connection, or null when disconnected */
  ws:                  null,
  myName:              '',
  myIsAdmin:           false,
  myIsDJ:              false,
  /** Set to true before intentionally closing ws (leave / kick / ban)
   *  so the close-event handler knows not to fire "unexpected disconnect". */
  leavingIntentionally: false,
  /** Rolling de-dup for consecutive messages from the same sender */
  lastSender: '',
  lastTime:   0,
  /** Custom message text color chosen by this user (hex string, or '' for default) */
  myColor: '',
}
