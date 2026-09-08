import { createProductServer } from "../../src/product/product-server.js";
import { Phase5FixtureCatalog, Phase5FixtureExecutor } from "./phase5-fixture-adapter.js";

const port = Number(process.env.PORT || 8787);
const executor = new Phase5FixtureExecutor();
createProductServer({ modelCatalog: new Phase5FixtureCatalog(), recognitionExecutor: executor, measurementExecutor: executor }).listen(port);
