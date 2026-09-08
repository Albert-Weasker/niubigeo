import { createProductServer } from "../../src/product/product-server.js";
import { Phase4FixtureCatalog, Phase4FixtureExecutor } from "./phase4-fixture-adapter.js";

const port = Number(process.env.PORT || 8787);
createProductServer({ modelCatalog: new Phase4FixtureCatalog(), recognitionExecutor: new Phase4FixtureExecutor() }).listen(port);
