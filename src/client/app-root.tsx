import React, { useEffect, useState } from "react";
import { TLDrawCanvas } from "./tldraw-root";
import { BACKEND_URL } from "./boilerplate";
import ReactDOM from "react-dom/client";
import "./index.css";

/**
 * Controls our single page. Handles authentication and renders the TLDraw
 * canvas if it's successful.
 */
function App() {
  // null means this is still loading; false means authentication failed; string
  // is the username of the current user if authentication succeeded
  const [user, setUser] = useState<string | false | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/isauthenticated`).then(async (res) => {
      const result: { success: boolean; user: string } = await res.json();
      if (result.success) {
        setUser(result.user);
      } else {
        setUser(false);
      }
    });
  }, []);

  if (user) {
    return <TLDrawCanvas username={user} />;
  } else if (user === null) {
    return <p>Authenticating...</p>;
  } else {
    const params = new URLSearchParams(window.location.search);
    return (
      <div>
        {!!params.get("error") && <p>Error: {params.get("error")}</p>}
        <a href={`${BACKEND_URL}/login/github`}>Login with Github</a>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
