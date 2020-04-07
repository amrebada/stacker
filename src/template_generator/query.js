import { getTemplate, listFiles } from "../utils";
import { join } from "path";
import { writeFileSync } from "fs";
import { getConfigEndpoint } from "../main";

const template = `
import { Query } from "..";
import { {{name}}Type } from "../../controller/{{name}}.controller";

class {{name}}Query {

  static create({{name}}: {{name}}Type): Query {
    return [
      "INSERT INTO {{name}} ({{fields_name}}) VALUES ({{fields_num}})",
      [
        {{fields_var_name}}
      ]
    ];
  }

  static update({{name}}: {{name}}Type): Query {
    return [
      "UPDATE {{name}} SET {{fields_name_num}} WHERE id = $1",
      [
        {{name}}.id,
        {{fields_var_name}}
      ]
    ];
  }

  static delete(id: number): Query {
    return ["DELETE FROM {{name}} WHERE id = $1;{{delete_others}}", [id]];
  }

  static getById(id: number): Query {
    return ["{{select_format_id}}", [id]];
  }

  static findAll(start=0, limit=100): Query {
    return ["{{select_format}} LIMIT $1 OFFSET $2", [limit, start]];
  }

  static searchfor(query: string, limit=100): Query {
    return [
      'SELECT * FROM {{name}} WHERE {{like_fields}} LIMIT $2',
      [\`%\${query.toLowerCase()}%\`, limit]
    ];
  }

  static getNumberOfRecords(){
    return ['SELECT count(*) FROM {{name}};',[]]
  }

}

export default {{name}}Query;
`;

function likeFormat(fields = []) {
  if (fields.length === 0) {
    return " $1 = $1";
  }
  return fields.map((f) => `LOWER("${f.name}") LIKE $1`).join(" OR ");
}

function getDeleteFormat(endpoint, relations = []) {
  if (relations.length === 0) {
    return "";
  }
  return relations
    .map((relate) => `DELETE FROM ${relate.table} WHERE ${relate.field}=$1`)
    .join(";");
}

async function getSelectFormat(endpoint, relations = [], id_condition = false) {
  if (relations.length === 0) {
    return `SELECT * FROM ${endpoint.name}${
      id_condition ? " WHERE id=$1" : ""
    }`;
  }
  let _relations = [];
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i];

    _relations = [
      ..._relations,
      {
        field: r.field,
        endpoint: await getConfigEndpoint(r.table),
      },
    ];
  }

  return `SELECT ${endpoint.fields
    .map((f) => endpoint.name + "." + f.name + " as " + f.name)
    .join(",")},${_relations
    .map((r) =>
      r.endpoint.fields
        .map(
          (f) =>
            r.endpoint.name +
            "." +
            f.name +
            " as _" +
            r.endpoint.name +
            "_" +
            f.name
        )
        .join(",")
    )
    .join(",")} FROM ${endpoint.name} ${_relations.map(
    (r) =>
      "join " +
      r.endpoint.name +
      " on " +
      endpoint.name +
      "." +
      r.field +
      "=" +
      r.endpoint.name +
      ".id"
  )}${id_condition ? " WHERE id=$1" : ""}`;
}

export const createQueryFile = async (endpoint, relations) => {
  const base_path = "./src/database/query";
  const query_file = `${endpoint.name}.query.ts`;

  if ((await listFiles(base_path)).includes(query_file)) {
    return false;
  }
  const result = getTemplate(template, [
    { name: "name", value: endpoint.name },
    {
      name: "fields_name",
      value: endpoint.fields.map((f) => f.name).join(","),
    },
    {
      name: "fields_num",
      value: endpoint.fields.map((_, i) => `$${i + 1}`).join(","),
    },
    {
      name: "fields_name_num",
      value: endpoint.fields.map((f, i) => `${f.name}=$${i + 2}`).join(","),
    },
    {
      name: "fields_var_name",
      value: endpoint.fields.map((f) => `${endpoint.name}.${f.name}`).join(","),
    },
    {
      name: "like_fields",
      value: likeFormat(endpoint.fields.filter((f) => f.search)),
    },
    {
      name: "delete_others",
      value: getDeleteFormat(endpoint, relations.relate_tables),
    },
    {
      name: "select_format_id",
      value: await getSelectFormat(endpoint, relations.fk_relations, true),
    },
    {
      name: "select_format",
      value: await getSelectFormat(endpoint, relations.fk_relations),
    },
  ]);

  writeFileSync(join(base_path, query_file), result, { encoding: "utf8" });

  return true;
};
