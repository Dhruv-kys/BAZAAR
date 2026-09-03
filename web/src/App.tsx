import { AgentDoor } from "./agents/AgentDoor";
import { Dashboard } from "./dashboard/Dashboard";
import { Landing } from "./landing/Landing";
import { Protocols } from "./pages/Protocols";
import { usePath } from "./router";
import { Workspace } from "./Workspace";

function App() {
  const path = usePath();
  if (path === "/app") return <Workspace />;
  if (path === "/dashboard") return <Dashboard />;
  if (path === "/agents") return <AgentDoor />;
  if (path === "/protocols") return <Protocols />;
  return <Landing />;
}

export default App;
