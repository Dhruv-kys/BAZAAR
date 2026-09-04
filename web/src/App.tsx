import { McpDoor } from "./mcp/McpDoor";
import { Dashboard } from "./dashboard/Dashboard";
import { Landing } from "./landing/Landing";
import { Protocols } from "./pages/Protocols";
import { usePath } from "./router";
import { AmbientFlowers } from "./AmbientFlowers";
import { Workspace } from "./Workspace";

function Route() {
  const path = usePath();
  if (path === "/app") return <Workspace />;
  if (path === "/dashboard") return <Dashboard />;
  if (path === "/mcp") return <McpDoor />;
  if (path === "/protocols") return <Protocols />;
  return <Landing />;
}

function App() {
  return (
    <>
      <AmbientFlowers />
      <Route />
    </>
  );
}

export default App;
