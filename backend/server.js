const express = require("express");
const bodyParser = require("body-parser");
const { Parser } = require("json2csv");
const { toXML } = require("jstoxml");
const yaml = require("js-yaml");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { createCanvas } = require("canvas");
const multer = require("multer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const csvtojson = require("csvtojson");
const xml2js = require("xml2js");

const cache = new Map();
const app = express();
const PORT = 5000;
const limit = 15;
const timeWindow = 15; // Minutes

const limiter = rateLimit({
  windowMs: timeWindow * 60 * 1000,
  limit: limit,
  message: `You have reached the max quota of ${limit} requests. Please wait for ${timeWindow} minutes!`,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use(limiter);

// Syntax Validation for JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Check JSON syntax and try again!" });
  }
  next();
});

app.post("/convert", upload.single("file"), async (req, res) => {
  const { data: inputData, inputFormat, outputFormat } = req.body;
  const file = req.file;
  let data;

  try {
    if (file) {
      const fileContent = file.buffer.toString("utf-8");
      const fileType = getFileType(file.originalname);
      data = await parseData(fileContent, fileType);
    } else {
      data = await parseData(inputData, inputFormat);
    }
  } catch (error) {
    console.error("Error parsing data:", error);
    return res.status(400).json({ error: "Invalid input data or format" });
  }

  const cacheKey = `${JSON.stringify(data)}-${outputFormat}`;
  if (cache.has(cacheKey)) {
    console.log("Using Cache for optimization");
    return res.send(cache.get(cacheKey));
  }

  let result;
  try {
    result = await convertData(data, outputFormat, res);
  } catch (error) {
    console.error(`Error converting to ${outputFormat.toUpperCase()}:`, error);
    return res.status(500).json({ error: `Error converting to ${outputFormat.toUpperCase()}` });
  }

  cache.set(cacheKey, result);
  if (outputFormat !== "pdf") {
    res.send(result);
  }
});

function getFileType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      throw new Error('Unsupported file type');
  }
}

async function parseData(data, format) {
  try {
    switch (format) {
      case "json":
        return JSON.parse(data);
      case "csv":
        return await csvtojson().fromString(data);
      case "xml":
        return await xml2js.parseStringPromise(data, { mergeAttrs: true });
      case "yaml":
        return yaml.load(data);
      default:
        throw new Error("Unsupported input format");
    }
  } catch (error) {
    throw new Error("Error parsing input data");
  }
}

async function convertData(data, format, res) {
  try {
    switch (format) {
      case "json":
        res.header("Content-Type", "application/json");
        res.attachment("data.json");
        return JSON.stringify(data, null, 2);
      case "csv":
        const parser = new Parser();
        res.header("Content-Type", "text/csv");
        res.attachment("data.csv");
        return parser.parse(data);
      case "xml":
        res.header("Content-Type", "application/xml");
        res.attachment("data.xml");
        return toXML(data, { indent: "    " });
      case "yaml":
        res.header("Content-Type", "application/x-yaml");
        res.attachment("data.yaml");
        return yaml.dump(data);
      case "pdf":
        const doc = new PDFDocument();
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const result = Buffer.concat(chunks);
          res.header("Content-Type", "application/pdf");
          res.attachment("data.pdf");
          res.send(result);
        });

        if (typeof data === 'string') {
          doc.text(data);
        } else if (Array.isArray(data)) {
          data.forEach(item => doc.text(JSON.stringify(item, null, 2)));
        } else {
          doc.text(JSON.stringify(data, null, 2));
        }

        doc.end();
        return;
      case "xlsx":
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sheet 1");
        const keys = Object.keys(data[0]);
        worksheet.columns = keys.map((key) => ({ header: key, key }));
        worksheet.addRows(data);
        res.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.attachment("data.xlsx");
        await workbook.xlsx.write(res);
        return;
      case "png":
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000000";
        ctx.font = "20px Arial";
        ctx.fillText(JSON.stringify(data, null, 2), 50, 50);
        const buffer = canvas.toBuffer("image/png");
        res.header("Content-Disposition", `attachment; filename=data.png`);
        res.header("Content-Type", "image/png");
        res.send(buffer);
        return;
      default:
        throw new Error("Unsupported output format");
    }
  } catch (error) {
    throw new Error("Error converting data");
  }
}

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Internal server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
