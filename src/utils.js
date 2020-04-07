import {
  readdir,
  realpath,
  mkdir,
  existsSync,
  lstatSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  readFile,
} from "fs";
import { join, basename } from "path";
export function notHas(files = [], probabilies = []) {
  for (let i = 0; i < probabilies.length; i++) {
    const element1 = probabilies[i];
    let isNotFound = false;
    for (let j = 0; j < files.length; j++) {
      const element2 = files[j];
      if (element2.endsWith(element1)) {
        isNotFound = true;
        break;
      }
    }
    if (isNotFound) {
      throw new Error(`Error: ${probabilies} already generated`);
    }
  }
}

export function has(files = [], probabilies = []) {
  for (let i = 0; i < probabilies.length; i++) {
    const element1 = probabilies[i];
    let isFound = false;
    for (let j = 0; j < files.length; j++) {
      const element2 = files[j];
      if (element2.endsWith(element1)) {
        isFound = true;
        break;
      }
    }
    if (!isFound) {
      throw { message: `Error: Cannot find ${probabilies}` };
    }
  }
}

export const listFiles = (path) => {
  return new Promise((resolve, reject) => {
    readdir(path, (err, files) => {
      if (err) {
        return reject(err);
      }
      resolve(files);
    });
  });
};

export const convertToFullpath = (files) => {
  return new Promise((resolve, reject) => {
    realpath(".", (err, rp) => {
      if (err) {
        return reject(err);
      }
      resolve(files.map((f) => join(rp, f)));
    });
  });
};

export const createDir = (root, name) => {
  return new Promise((resolve, reject) => {
    mkdir(join(root, name), (err) => {
      if (err) {
        return reject(err);
      }
      resolve(join(root, name));
    });
  });
};

export const copyFileSync = (source, target) => {
  var targetFile = target;
  //if target is a directory a new file with the same name will be created
  if (existsSync(target)) {
    if (lstatSync(target).isDirectory()) {
      targetFile = join(target, basename(source));
    }
  }
  writeFileSync(targetFile, readFileSync(source));
};

export const copyRecursive = (source, target, include = false) => {
  let files = [];
  //check if folder needs to be created or integrated
  let targetFolder = include ? join(target, basename(source)) : target;
  if (!existsSync(targetFolder)) {
    mkdirSync(targetFolder);
  }
  //copy
  if (lstatSync(source).isDirectory()) {
    files = readdirSync(source);
    files.forEach(function (file) {
      var curSource = join(source, file);
      if (lstatSync(curSource).isDirectory()) {
        copyRecursive(curSource, targetFolder, true);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
};

export function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    readFile(file, { encoding: "utf8" }, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
}

async function modifyResolvers(domain) {
  const data = await readFileAsync(`./src/resolvers.ts`);
  const lines = data.split("\n");

  let includes = [];
  for (const line of lines) {
    if (line.includes("./")) {
      includes.push(line.trim().split(" ")[1]);
    }
  }
  includes.push(domain);
  const template = `
${includes.map((inc) => `import ${inc} from "./${inc}";`).join("\n")}
export default {
 Query: {
     ${includes.map((inc) => `...${inc}.services.query,`).join("\n\t\t")}
 },
 Mutation: {
     ${includes.map((inc) => `...${inc}.services.mutation,`).join("\n\t\t")}
 }
}
 `;
  writeFileSync(`./src/resolvers.ts`, template, { encoding: "utf8" });
}

async function modifyTypes(domain) {
  const data = await readFileAsync(`./src/types.ts`);
  const lines = data.split("\n");

  let includes = [];
  for (const line of lines) {
    if (line.includes("./")) {
      includes.push(line.trim().split(" ")[1]);
    }
  }
  includes.push(domain);
  const template = `import { gql } from "apollo-server";
${includes.map((inc) => `import ${inc} from "./${inc}";`).join("\n")}

export default gql\`
 # Query
 type Query {
     ${includes.map((inc) => `\${${inc}.query}`).join("\n\t\t")}
 }
 # Mutation
 type Mutation {
     ${includes.map((inc) => `\${${inc}.mutations}`).join("\n\t\t")}
 }
 #types
 ${includes.map((inc) => `\${${inc}.types}`).join("\n\t")}
 #fragments
 ${includes.map((inc) => `\${${inc}.fragments}`).join("\n\t")}
\`
 `;
  writeFileSync(`./src/types.ts`, template, { encoding: "utf8" });
}

const getType = (stringType) => {
  switch (stringType.toLowerCase()) {
    case "number":
      return "BIGINT";
    case "bool":
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "TIMESTAMP";
    case "string":
    default:
      return "TEXT";
  }
};

export const modifyMigrate = async (endpoint) => {
  const path = "./src/database/migrate.ts";
  const data = await readFileAsync(path);
  const upper = data.slice(0, data.indexOf("} catch (error) {"));
  const template = `${upper}
  //${endpoint.name};
    await client.query(\`
      CREATE TABLE IF NOT EXISTS ${endpoint.name} (
        id serial PRIMARY KEY,
        ${endpoint.fields
          .map(
            (column) =>
              `${column.name} ${getType(column.type)}${
                column.unique ? " UNIQUE" : ""
              }${column.unique ? " NOT NULL" : ""}${
                endpoint.relations.filter((r) => r.field === column.name)
                  .length > 0
                  ? ` REFERENCES ${
                      endpoint.relations.filter(
                        (r) => r.field === column.name
                      )[0].table
                    }(id)`
                  : ""
              }`
          )
          .join(",\n\t\t\t\t")},
        g_created_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    \`);
  } catch (error) {
    console.log(error);
  }
};
  `;
  if (!data.includes(`//${endpoint.name};`)) {
    writeFileSync(path, template, { encoding: "utf8" });
    return true;
  }
  return false;
};

export const getTemplate = (template = "", args = []) => {
  for (const argument of args) {
    template = template.replace(
      new RegExp(`{{${argument.name}}}`, "ig"),
      argument.value.toString()
    );
  }
  return template;
};
