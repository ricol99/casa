import { isRouteErrorResponse, useRouteError } from "react-router-dom";

function describeError(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown render error";
}

export function RootErrorPage() {
  const error = useRouteError();
  const message = describeError(error);

  return (
    <section className="card">
      <h2>UI runtime error</h2>
      <p className="error">{message}</p>
      <p className="meta">Open browser console for stack details, then share the message here.</p>
    </section>
  );
}
