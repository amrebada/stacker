import { readdirSync, realpathSync } from "fs";

import clone from "git-clone";

import chalk from "chalk";
import { has, listFiles, convertToFullpath, modifyMigrate } from "./utils";
import { createQueryFile } from "./template_generator/query";
import { createControllerFile } from "./template_generator/controller";
import {
  createRouterFile,
  modifyRouteIndex,
} from "./template_generator/router";

async function checkProject(files = [], domain) {
  //check src
  has(files, ["src", "stacker.json", "public", "private"]);
  //check files
  let srcFiles = await listFiles("./src");
  srcFiles = await convertToFullpath(srcFiles);
  has(srcFiles, [
    "config.ts",
    "constants.ts",
    "server.ts",
    "utils.ts",
    "route",
    "middleware",
    "database",
    "controller",
  ]);

  const routeFiles = await listFiles("./src/route");
  const middlewareFiles = await listFiles("./src/middleware");
  const databaseFiles = await listFiles("./src/database");
  has(routeFiles, ["index.ts"]);
  has(middlewareFiles, ["index.ts"]);
  has(databaseFiles, ["index.ts", "migrate.ts", "query"]);
  return true;
}

export const RelationsEnum = {
  normal: "NORMAL",
  has_fk: "HAS_FK",
  relate_with: "RELATE_WITH",
};

async function getRelation(endpoint) {
  const endpoints = await getConfigEndpoints();
  const relate_tables = endpoints
    .filter(
      (e) => e.relations.filter((r) => r.table === endpoint.name).length !== 0
    )
    .map((e) => ({
      table: e.name,
      field: e.relations.filter((r) => r.table === endpoint.name)[0].field,
    }));
  return {
    relate_tables: relate_tables,
    fk_relations: endpoint.relations,
  };
}

async function generateEndpoint(endpoint) {
  console.log(chalk.yellowBright(`Generating Endpoint ${endpoint.name}...`));
  //check relations
  const relations = await getRelation(endpoint);
  //create migrate
  if (!(await modifyMigrate(endpoint))) return false;
  //create database query
  if (!(await createQueryFile(endpoint, relations))) return false;
  //create controller
  if (!(await createControllerFile(endpoint))) return false;
  //create route
  if (!(await createRouterFile(endpoint))) return false;
  if (!(await modifyRouteIndex(endpoint))) return false;
  console.log(chalk.green(`Endpoint ${endpoint.name} Generated`));
  return true;
}

export async function getConfigEndpoint(name) {
  const endpoints = await getConfigEndpoints();
  const endpoint = endpoints.filter((e) => e.name === name);

  return endpoint.length > 0 ? endpoint[0] : null;
}

async function checkEndPoints() {
  const endpoints = await getConfigEndpoints();
  const remaining = [];
  const routeFiles = await listFiles("./src/route");
  const controllerFiles = await listFiles("./src/controller");
  const databaseFiles = await listFiles("./src/database/query");
  for (const endpoint of endpoints) {
    try {
      has(routeFiles, [`${endpoint.name}.route.ts`]);
      has(controllerFiles, [`${endpoint.name}.controller.ts`]);
      has(databaseFiles, [`${endpoint.name}.query.ts`]);
    } catch (error) {
      remaining.push(endpoint);
    }
  }
  return remaining;
}

async function getConfigEndpoints() {
  const config = await require(realpathSync("./stacker.json"));
  return config.endpoints;
}

async function generateEndpoints() {
  if (await checkProject(await listFiles("."))) {
    const remaining = await checkEndPoints();
    for (const endpoint of remaining) {
      const isGenerated = await generateEndpoint(endpoint);
      if (!isGenerated) {
        console.log(chalk.red(`Couldn't generate endpoint ${endpoint.name}`));
      }
    }
  }
}

function getRandomAppName() {
  const files = readdirSync(".");
  let last = 0;
  for (const file of files) {
    if (file.startsWith("app")) {
      const num = parseInt(file.slice(file.length - 1, file.length));
      if (num > last) {
        last = num;
      }
    }
  }
  return `app${last + 1}`;
}

export const startGenerate = async (files, options, shortcut = false) => {
  if (shortcut) {
    console.log("Generating endpoints ...");
    await generateEndpoints();
  } else {
    switch (options.generate) {
      case "app":
        console.log("Cloning template ...");
        const appName = options.name ? options.name : getRandomAppName();
        clone(
          "https://github.com/amrebada/stacker-api-template-pg",
          "./" + appName,
          () => {
            console.log(chalk.green("Done !"));
            console.log();
            console.log(chalk.cyan(" cd " + appName));
            console.log(chalk.cyan(" stacker ."));
          }
        );

        break;
      case "endpoint":
        console.log("Generating endpoints ...");
        await generateEndpoints();
        break;
      default:
        throw { message: "unknown type of generator" };
    }
  }

  // const srcPath = await checkProject(files, domain);
  // const isGenerated = await generateTemplate(srcPath, domain);
  // if (isGenerated) {
  //   await modifyGeneralFiles(domain);
  //   console.log(`[+] Generate ${domain} successfully`);
  // }
};
