import {promisify} from "util";
import * as fs from "fs";
import * as path from "path";
import * as commandpost from "commandpost";
import {render, save} from "./renderer";

const mkdir = promisify(fs.mkdir);

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

interface Opts {
  output: string[];
}

interface Args {
  input: string;
}

const root = commandpost
  .create<Opts, Args>("cowlick-export-pdf [input]")
  .version(packageJson.version, "-v, --version")
  .description("pdf converter for cowlick scenario")
  .option("-o, --output <output>", "output file")
  .action(async (opts, args) => {
    const cwd = process.cwd();
    const output = path.resolve(cwd, opts.output[0] || "output.pdf");
    const outputPath = path.dirname(output);
    const target = path.resolve(cwd, args.input);
    const basePath = path.dirname(target);
    const pdf = render(require(target), basePath);
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
