import { getTemplate, listFiles, readFileAsync } from "../utils";
import { join } from "path";
import { writeFileSync, mkdirSync } from "fs";
const template = `
import { Router } from "express";
import { response, checkParams } from "../utils";
import multer from "multer";
import { join } from "path";
import controller, {
  {{name}}Type,
} from "../controller/{{name}}.controller";
const router = Router();

//Uplaod
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, join(__dirname, "../../public/{{name}}/"));
  },
  filename: function (req: any, file, cb) {
    req[file.fieldname] = \`/public/{{name}}/\${file.originalname}\`;

    cb(null, file.originalname);
  },
});
const uploadEngine = multer({ storage });
// router.post("/upload");

//Create
router.post(
  "/",
  uploadEngine.fields([
    {{file_storage}}
  ]),
  async (req: any, res) => {
    try {
      const { {{file_fields}} } = req;
      const { {{fields}} } = req.body;
      checkParams({{all_fields}});

      res.json(
        response(
          null,
          await controller.create(<{{name}}Type>{
            {{all_fields}}
          })
        )
      );
    } catch (error) {
      res.json(response({ code: error.code, message: error.message }));
    }
  }
);

//Update
router.patch(
  "/",
  uploadEngine.fields([
    {{file_storage}}
  ]),
  async (req: any, res) => {
    try {
      const { {{file_fields}} } = req;
      const { id, {{fields}}} = req.body;
      checkParams(id);

      res.json(
        response(
          null,
          await controller.update(<{{name}}Type>{
            id, {{all_fields}}
          })
        )
      );
    } catch (error) {
      res.json(response({ code: error.code, message: error.message }));
    }
  }
);

//Delete
router.delete("/", async (req, res) => {
  try {
    const { id } = req.params;
    checkParams(id);
    res.json(response(null, await controller.delete(+id)));
  } catch (error) {
    res.json(response({ code: error.code, message: error.message }));
  }
});

//Get All {{name}}
router.get("/", async (req, res) => {
  try {
    const { start, limit } = req.query;
    res.json(response(null, await controller.getAll(start?start:0, limit?limit:1000)));
  } catch (error) {
    res.json(response({ code: error.code, message: error.message }));
  }
});

//Get by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    checkParams(id);
    res.json(response(null, await controller.getById(+id)));
  } catch (error) {
    res.json(response({ code: error.code, message: error.message }));
  }
});

//Get total count
router.get("/count", async (req, res) => {
  try {
    res.json(response(null, await controller.getCount()));
  } catch (error) {
    res.json(response({ code: error.code, message: error.message }));
  }
});

//search by name
router.get("/search", async (req, res) => {
  try {
    const { query , limit} = req.query;
    res.json(response(null, await controller.searchByName(query, limit?limit:1000)));
  } catch (error) {
    res.json(response({ code: error.code, message: error.message }));
  }
});

export default router;

`;

export const createRouterFile = async (endpoint) => {
  const base_path = "./src/route";
  const route_file = `${endpoint.name}.route.ts`;

  if ((await listFiles(base_path)).includes(route_file)) {
    return false;
  }
  const result = getTemplate(template, [
    { name: "name", value: endpoint.name },
    {
      name: "fields",
      value: endpoint.fields
        .filter((f) => f.type.toLowerCase() !== "file")
        .map((f) => f.name)
        .join(","),
    },
    {
      name: "all_fields",
      value: endpoint.fields.map((f) => f.name).join(","),
    },

    {
      name: "file_fields",
      value: endpoint.fields
        .filter((f) => f.type.toLowerCase() === "file")
        .map((f) => f.name)
        .join(","),
    },
    {
      name: "file_storage",
      value: endpoint.fields
        .filter((f) => f.type.toLowerCase() === "file")
        .map((f) => `  { name: "${f.name}", maxCount: 1 }`)
        .join(","),
    },
  ]);
  writeFileSync(join(base_path, route_file), result, { encoding: "utf8" });
  const publicDir = "./public";
  mkdirSync(join(publicDir, endpoint.name), { recursive: true });

  return true;
};

export const modifyRouteIndex = async (endpoint) => {
  const path = "./src/route/index.ts";
  const data = await readFileAsync(path);
  if (data.includes(`//${endpoint.name};`)) {
    return false;
  }
  const pattern0 = 'import { Router } from "express";';
  const pattern1 = "const router = Router();";
  const pattern2 = "export default router;";

  const upper1 = data.slice(
    data.indexOf(pattern0) + pattern0.length,
    data.indexOf(pattern1)
  );
  const upper2 = data.slice(
    data.indexOf(pattern1) + pattern1.length,
    data.indexOf(pattern2)
  );
  const _template = `
  import { Router } from "express";
${upper1}
  import ${endpoint.name}Router from "./${endpoint.name}.route";

  const router = Router();
${upper2}
  //${endpoint.name};
  router.use("/${endpoint.name}", ${endpoint.name}Router);

  export default router;
`;
  writeFileSync(path, _template, { encoding: "utf8" });
  return true;
};
