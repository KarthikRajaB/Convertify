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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  limit: 15,
  message: "You have reached the max quota of 5 requests. Please wait for some time!",
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use(limiter);

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
    return res.status(400).send("Invalid input data or format");
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
    return res.status(500).send(`Error converting to ${outputFormat.toUpperCase()}`);
  }

  cache.set(cacheKey, result);
  res.send(result);
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
}

async function convertData(data, format, res) {
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
      res.header("Content-Type", "application/pdf");
      res.attachment("data.pdf");
      doc.pipe(res);
      doc.text(JSON.stringify(data, null, 2));
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
    default:
      throw new Error("Unsupported output format");
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
