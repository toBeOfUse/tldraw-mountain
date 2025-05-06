import { useEffect, useState } from "react";
import { TLDrawCanvas } from "./custom-ui";
import { BACKEND_URL } from "./config";

/**
 * Controls our single page. Really just handles authentication.
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

export default App;
