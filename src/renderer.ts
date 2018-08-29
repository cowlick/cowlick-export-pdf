import * as pdfMake from "pdfmake/build/pdfmake";
const pdfFonts = require("../fonts/vfs_fonts");
(pdfMake as any).fonts = {
  LightNovelPOP: {
      normal: "ラノベPOP.ttf"
  }
};
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
import * as fs from "fs";
import * as path from "path";
import * as core from "@cowlick/core";
import {Assets} from "@akashic/akashic-cli-commons";

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

const imageDataURL = (filePath: string) => {
  const value = fs.readFileSync(filePath).toString("base64");
  return `data:image/${path.extname(filePath).substring(1)};base64,${value}`;
};

const createImage = (script: core.Image) => {
  const image: any = {
    image: script.assetId
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

const pushImageData = (contents: Contents, assetId: string, basePath: string, assets: Assets) => {
  if (assetId in contents.images === false) {
    const filePath = path.join(basePath, assets[assetId].path);
    contents.images[assetId] = imageDataURL(filePath);
  }
};

const pushImage = (contents: Contents, script: core.Image, basePath: string, assets: Assets) => {
  contents.content.push(createImage(script));
  pushImageData(contents, script.assetId, basePath, assets);
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
          y: 730 + 40 * i
        }
      };
    } else {
      throw new Error(`link not found: ${JSON.stringify(v)}`);
    }
  }));
};

const pushButton = (contents: Contents, script: core.Button, basePath: string, assets: Assets) => {
  const button = createImage(script.image);
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
  pushImageData(contents, script.image.assetId, basePath, assets);
};

const runScripts = (contents: Contents, scripts: core.Script[], basePath: string, assets: Assets) => {
  let pageBreak = false;
  for (const script of scripts) {
    switch (script.tag) {
      case core.Tag.text:
        pushText(contents, script);
        break;
      case core.Tag.image:
        pushImage(contents, script, basePath, assets);
        break;
      case core.Tag.choice:
        pushChoice(contents, script);
        pageBreak = true;
        break;
      case core.Tag.button:
        pushButton(contents, script, basePath, assets);
        pageBreak = true;
        break;
    }
  }
  return pageBreak;
};

const visit = (scene: core.Scene, basePath: string, assets: Assets) => {
  const contents: Contents = {
    content: [],
    images: {}
  };
  let page = 1;
  const mapper = new Map<number, number>();
  const frames = (scene as any).frames as core.Frame[];
  const length = frames.length;
  for (let i = 0; i < length; i++) {
    mapper.set(i, page);
    const pageBreak = runScripts(contents, frames[i].scripts, basePath, assets);
    if (i + 1 < length && pageBreak) {
      contents.content[contents.content.length - 1].pageBreak = "after";
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

export const render = (scene: core.Scene, basePath: string, assets: Assets) => {
  return pdfMake.createPdf({
    ...visit(scene, basePath, assets),
    pageSize: "SRA3",
    pageOrientation: "landscape",
    defaultStyle: {
      font: "LightNovelPOP"
    }
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
