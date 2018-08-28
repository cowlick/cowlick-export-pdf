import {promisify} from "util";
import * as fs from "fs";
import * as path from "path";
import * as commandpost from "commandpost";
import {render, save} from "./renderer";

const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

interface Opts {
  output: string[];
  dir: string[];
}

interface Args {
  input: string;
}

const root = commandpost
  .create<Opts, Args>("cowlick-export-pdf [input]")
  .version(packageJson.version, "-v, --version")
  .description("pdf converter for cowlick scenario")
  .option("-d, --dir <dir>", "target game directory")
  .option("-o, --output <output>", "output file")
  .action(async (opts, args) => {
    const cwd = process.cwd();
    const output = path.resolve(cwd, opts.output[0] || "output.pdf");
    const outputPath = path.dirname(output);
    const targetDir = path.resolve(cwd, opts.dir[0] || ".");
    const rawConfig = await readFile(path.join(targetDir, "game.json"), {encoding : "utf8"});
    const config = JSON.parse(rawConfig);
    if (config.assets === undefined) {
      throw new Error("game.jsonにassetを登録してから実行してください。");
    }
    const target = path.join(targetDir, config.assets[args.input].path);
    const pdf = render(require(target), targetDir, config.assets);
    try {
      await mkdir(outputPath);
    } catch (e) {}
    await save(pdf, output);
  });

commandpost.exec(root, process.argv).then(
  () => {
    process.stdout.write("");
    process.exit(0);
  },
  err => {
    console.error("uncaught error", err);
    process.exit(1);
  }
);
