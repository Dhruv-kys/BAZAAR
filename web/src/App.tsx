import { Dashboard } from "./dashboard/Dashboard";
import { Landing } from "./landing/Landing";
import { usePath } from "./router";
import { Workspace } from "./Workspace";

function App() {
  const path = usePath();
  if (path === "/app") return <Workspace />;
  if (path === "/dashboard") return <Dashboard />;
  return <Landing />;
}

export default App;
