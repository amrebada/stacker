import { getTemplate, listFiles } from "../utils";
import { join } from "path";
import { writeFileSync } from "fs";
const template = `
import database from "../database";
import Query from "../database/query/{{name}}.query";
import { ErrorType } from "../constants";

export interface {{name}}Type {
  id?: number;
  {{fields}}
}

class {{name}} {
  async create({{name}}: {{name}}Type) {
    return await (await database.client.query(...Query.create({{name}})))
      .rowCount;
  }

  async update({{name}}: {{name}}Type) {
    const OldRow = await this.getById({{name}}.id || 0);
    return await (
      await database.client.query(
        ...Query.update(this.getWithoutUndefined({{name}}, OldRow))
      )
    ).rowCount;
  }

  async delete(id: number) {
    return (await database.client.query(...Query.delete(id))).rows;
  }

  async getById(id: number) {
    const result = (await database.client.query(...Query.getById(id))).rows;
    if (result.length !== 1) {
      throw <ErrorType>{ code: 404, message: "Couldn't find this {{name}}" };
    }
    return result[0];
  }

  async searchByName(query: string, limit=100) {
    return (await database.client.query(...Query.searchfor(query,limit))).rows;
  }

  async getAll(start=0, limit=100) {
    return (await database.client.query(...Query.findAll(start, limit))).rows;
  }

  async getCount() {
    return (await database.client.query(...Query.getNumberOfRecords())).rows[0];
  }

  getWithoutUndefined(
    firstPriorty: {{name}}Type | any,
    secondPriority: {{name}}Type | any
  ) {
    for (const key in firstPriorty) {
      const element = firstPriorty[key];
      if (element === undefined) {
        firstPriorty[key] = secondPriority[key];
      }
    }
    return firstPriorty;
  }
}

export default new {{name}}();


`;

export const createControllerFile = async (endpoint) => {
  const base_path = "./src/controller";
  const controller_file = `${endpoint.name}.controller.ts`;

  if ((await listFiles(base_path)).includes(controller_file)) {
    return false;
  }
  const result = getTemplate(template, [
    { name: "name", value: endpoint.name },
    {
      name: "fields",
      value: endpoint.fields
        .map(
          (f) =>
            `${f.name}?: ${
              f.type.toLowerCase() === "date"
                ? "Date"
                : f.type.toLowerCase() === "file"
                ? "string"
                : f.type
            };`
        )
        .join("\n\t"),
    },
  ]);
  writeFileSync(join(base_path, controller_file), result, { encoding: "utf8" });

  return true;
};
