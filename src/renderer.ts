import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
import * as fs from "fs";
import * as path from "path";
import * as core from "@cowlick/core";

interface Contents {
  content: any[];
  images: { [name: string]: string };
}

const font = {
  color: "#ffffff",
  fontSize: 40
};

const pushText = (contents: Contents, script: core.Text) => {
  contents.content.push({
    ...font,
    text: script.values[0],
    absolutePosition: {
      x: 380,
      y: 550
    }
  });
};

const imageDataURL = (assetId: string, basePath: string) => {
  const str = path.join(basePath, assetId);
  const value = fs.readFileSync(str).toString("base64");
  return `data:image/${path.extname(str).substring(1)};base64,${value}`;
};

const createImage = (name: string, script: core.Image) => {
  const image: any = {
    image: name
  };
  if (script.layer.x !== undefined || script.layer.y !== undefined) {
    image.absolutePosition = {};
    if (script.layer.x !== undefined) {
      image.absolutePosition.x = script.layer.x;
    }
    if (script.layer.y !== undefined) {
      image.absolutePosition.y = script.layer.y;
    }
  }
  return image;
};

const pushImage = (contents: Contents, script: core.Image, basePath: string) => {
  const name = path.basename(script.assetId, path.extname(script.assetId));
  contents.content.push(createImage(name, script));
  contents.images[name] = imageDataURL(script.assetId, basePath);
};

const pushChoice = (contents: Contents, script: core.Choice) => {
  contents.content.push(...script.values.map((v, i) => {
    if (v.frame !== undefined) {
      return {
        ...font,
        text: v.text,
        linkToPage: v.frame,
        absolutePosition: {
          x: 380,
          y: 730 + 50 * i
        }
      };
    } else {
      throw new Error(`link not found: ${JSON.stringify(v)}`);
    }
  }));
};

const pushButton = (contents: Contents, script: core.Button, basePath: string) => {
  const name = path.basename(script.image.assetId, path.extname(script.image.assetId));
  const button = createImage(name, script.image);
  button.absolutePosition = {
    x: script.x,
    y: script.y
  };
  const jump = script.scripts.find(s => s.tag === core.Tag.jump);
  if (jump === undefined) {
    throw new Error("buttonにjumpタグが設定されていません: " + JSON.stringify(script));
  }
  const frame = (jump as core.Jump).frame;
  if (frame === undefined) {
    throw new Error("buttonのjumpタグにframeが設定されていません: " + JSON.stringify(script));
  }
  button.linkToPage = frame;
  contents.content.push(button);
  contents.images[name] = imageDataURL(script.image.assetId, basePath);
};

const runScripts = (contents: Contents, scripts: core.Script[], basePath: string) => {
  let pageBreak = false;
  for (const script of scripts) {
    switch (script.tag) {
      case core.Tag.text:
        pushText(contents, script);
        break;
      case core.Tag.image:
        pushImage(contents, script, basePath);
        break;
      case core.Tag.choice:
        pushChoice(contents, script);
        pageBreak = true;
        break;
      case core.Tag.button:
        pushButton(contents, script, basePath);
        pageBreak = true;
        break;
    }
  }
  return pageBreak;
};

const visit = (scene: core.Scene, basePath: string) => {
  const contents: Contents = {
    content: [],
    images: {}
  };
  let index = 0;
  let page = 1;
  const mapper = new Map<number, number>();
  const frames = (scene as any).frames as core.Frame[];
  const length = frames.length;
  for (const frame of frames) {
    mapper.set(index, page);
    const pageBreak = runScripts(contents, frame.scripts, basePath);
    index++;
    if (index < length && pageBreak) {
      contents.content.push({
        text: "",
        pageBreak: "after"
      });
      page++;
    }
  }
  for (const c of contents.content) {
    if ("linkToPage" in c) {
      c.linkToPage = mapper.get(c.linkToPage);
    }
  }
  return contents;
};

export const render = (scene: core.Scene, basePath: string) => {
  return pdfMake.createPdf({
    ...visit(scene, basePath),
    pageSize: "SRA3",
    pageOrientation: "landscape",
  } as any);
};

export const save = async (pdf: pdfMake.TCreatedPdf, output: string) => {
  return new Promise<void>(resolve => {
    (pdf as any).getBuffer((buffer: Buffer) => {
      fs.writeFileSync(output, buffer);
      resolve();
    });
  });
};
