import { argument } from "./site-lib";
import { verifySite } from "./site-verify-lib";

const result = await verifySite(argument("site") ?? "");
console.log(JSON.stringify(result, null, 2));
