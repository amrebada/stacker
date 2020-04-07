import arg from "arg";
import { startGenerate } from "./main";
import chalk from "chalk";
import { listFiles, convertToFullpath } from "./utils";
function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      "--help": Boolean,
      "--generate": String,
      "--name": String,
      "-g": "--generate",
      "-h": "--help",
      "-n": "--name"
    },
    {
      argv: rawArgs.slice(2)
    }
  );
  return {
    generate: args["--generate"],
    help: args["--help"] || false,
    name: args["--name"]
  };
}

function printHelp() {
  console.log(`stacker CLI : Usage (stacker --help)
  stacker [option] <args>
  options:
      --generate, -g  <type> [app, endpoint]
      --name, -n  <name> default app1
`);
}

export async function cli(args) {
  let options;
  try {
    options = parseArgumentsIntoOptions(args);

    const shortcut = args[2] === "." || args.length === 2;
    if ((!options.generate && !shortcut) || options.help) {
      printHelp();
      return;
    }

    const files = await listFiles(".");
    const fullfiles = await convertToFullpath(files);
    await startGenerate(fullfiles, options, shortcut);
  } catch (error) {
    console.log(error);

    console.log(chalk.red(error.message));
    console.log("--------------------------");
    printHelp();
    return;
  }
}
