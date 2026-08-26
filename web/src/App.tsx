import { Landing } from "./landing/Landing";
import { usePath } from "./router";
import { Workspace } from "./Workspace";

function App() {
  const path = usePath();
  return path === "/app" ? <Workspace /> : <Landing />;
}

export default App;
