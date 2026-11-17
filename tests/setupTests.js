// Global setup for happy-dom test environment
if (typeof window !== 'undefined') {
  // Ensure basic mock implementations for window methods if not present
  if (!window.confirm) {
    window.confirm = () => true;
  }
  if (!window.alert) {
    window.alert = () => {};
  }
}
