// Wraps an async Express route handler so a thrown/rejected error is passed to
// Express's error handler instead of becoming an unhandled promise rejection
// (which crashes the whole process on Node 15+).
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
