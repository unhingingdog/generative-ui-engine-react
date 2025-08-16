import { startExample } from "./example/example-setup-agent-client-side";
import "./index.css";
import "./App.css";

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  startExample();
}
