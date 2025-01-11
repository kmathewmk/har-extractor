import * as fs from "fs";
import { Har, Entry } from "har-format";
import * as path from "path";

const filenamify = require("filenamify");
const humanizeUrl = require("humanize-url");
const makeDir = require("make-dir");
export const getEntryContentAsBuffer = (entry: Entry): Buffer | undefined => {
    const content = entry.response.content;
    const text = content.text;
    if (text === undefined) {
        return;
    }
    if (content.encoding === "base64") {
        return Buffer.from(text, "base64");
    } else {
        return Buffer.from(text);
    }
};

export const convertEntryAsFilePathFormat = (entry: Entry, removeQueryString: boolean = false): string[] => {
    const requestURL = entry.request.url;
    const stripSchemaURL: string = humanizeUrl(removeQueryString ? requestURL.split("?")[0] : requestURL);
    const dirnames: string[] = stripSchemaURL.split("/").map((pathname) => {
        return filenamify(pathname);
    });
    let fileName = dirnames[dirnames.length - 1];
    if (
        fileName &&
        !fileName.includes(".html") &&
        entry.response.content.mimeType &&
        entry.response.content.mimeType.includes("text/html")
    ) {
        fileName = "index.html";
        dirnames.push(fileName);
    }
    return dirnames;
};

export interface ExtractOptions {
    outputDir: string;
    verbose?: boolean;
    dryRun?: boolean;
    removeQueryString?: boolean;
    putReqStartDateTimeInFileName?: boolean;
}

export const extract = (harContent: Har, options: ExtractOptions) => {
    harContent.log.entries.forEach((entry) => {
        const buffer = getEntryContentAsBuffer(entry);
        if (!buffer) {
            return;
        }
        let dirnames: string[] = convertEntryAsFilePathFormat(entry, options.removeQueryString);
        dirnames.splice(0, 0, options.outputDir);
        let outputPath: string = dirnames.join(path.sep);
        let outputPathExists: boolean = fs.existsSync(outputPath);
        if (outputPathExists) {
            if (options.putReqStartDateTimeInFileName) {
                let fileName = dirnames[dirnames.length - 1];
                // prefix req start datetime so that file is not overwritten
                fileName = `${entry.startedDateTime}-${fileName}`;
                dirnames[dirnames.length - 1] = fileName;
                outputPath = dirnames.join(path.sep);
            } else {
                // file will be overwritten
            }
        }
        if (options.verbose) {
            console.log(entry.startedDateTime, outputPathExists, process.cwd(), outputPath);
        }
        let outputDir = path.dirname(outputPath);
        if (!options.dryRun) {
            // rename file if any for upcoming directory
            if (fs.existsSync(outputDir) && fs.lstatSync(outputDir).isFile()) {
                fs.renameSync(outputDir, outputDir + "-renamedForDir");
            }
            makeDir.sync(outputDir);
        }
        if (!options.dryRun) {
            fs.writeFileSync(outputPath, buffer);
        }
    });
};
