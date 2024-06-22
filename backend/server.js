const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const { Parser } = require("json2csv");
const { toXML } = require("jstoxml");
const yaml = require("js-yaml");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { createCanvas, loadImage, registerFont } = require("canvas");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

const cache = new Map();
const app = express();
const PORT = 5000;
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  limit: 15,
  message:
    "You have reached the max quota of 5 requests. Please wait for some time!",
});

app.use(cors()); // Use cors middleware
app.use(bodyParser.json());
app.use(limiter);

const upload = multer({ dest: "uploads/" });

app.post("/convert", upload.single("file"), async (req, res) => {
  const { data, inputFormat, outputFormat } = req.body;
  const file = req.file;

  let jsonData;

  if (file) {
    const fileContent = fs.readFileSync(file.path, "utf8");
    const ext = file.originalname.split('.').pop().toLowerCase();
    try {
      switch (ext) {
        case 'json':
          jsonData = JSON.parse(fileContent);
          break;
        case 'xml':
          const xml2js = require('xml2js');
          const parser = new xml2js.Parser();
          jsonData = await parser.parseStringPromise(fileContent);
          break;
        case 'yaml':
        case 'yml':
          jsonData = yaml.load(fileContent);
          break;
        case 'csv':
          const csv = require('csvtojson');
          jsonData = await csv().fromString(fileContent);
          break;
        case 'xlsx':
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(fileContent);
          const worksheet = workbook.worksheets[0];
          jsonData = worksheet.getSheetValues().slice(1);
          break;
        default:
          return res.status(400).send("Unsupported file format");
      }
    } catch (error) {
      return res.status(400).send(`Error processing ${ext} file`);
    }
  } else {
    try {
      jsonData = JSON.parse(data);
    } catch (error) {
      return res.status(400).send("Invalid JSON data");
    }
  }

  const cacheKey = `${JSON.stringify(jsonData)}-${outputFormat}`;

  if (cache.has(cacheKey)) {
    console.log("Using Cache for optimization");
    return res.send(cache.get(cacheKey));
  }

  let result;
  switch (outputFormat) {
    case "csv":
      try {
        const parser = new Parser();
        result = parser.parse(jsonData);
        res.header("Content-Type", "text/csv");
        res.attachment("data.csv");
      } catch (error) {
        return res.status(500).send("Error converting to CSV");
      }
      break;

    case "xml":
      try {
        result = toXML(jsonData, {
          indent: "    ",
        });
        res.header("Content-Type", "application/xml");
        res.attachment("data.xml");
      } catch (error) {
        return res.status(500).send("Error converting to XML");
      }
      break;

    case "yaml":
      try {
        result = yaml.dump(jsonData);
        res.header("Content-Type", "application/x-yaml");
        res.attachment("data.yaml");
      } catch (error) {
        return res.status(500).send("Error converting to YAML");
      }
      break;

    case "pdf":
      try {
        const doc = new PDFDocument();
        res.header("Content-Type", "application/pdf");
        res.attachment("data.pdf");
        doc.pipe(res);
        doc.text(JSON.stringify(jsonData, null, 2));
        doc.end();
      } catch (error) {
        return res.status(500).send("Error converting to PDF");
      }
      return;

    case "xlsx":
      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sheet 1");
        const keys = Object.keys(jsonData[0]);
        worksheet.columns = keys.map((key) => ({ header: key, key }));
        worksheet.addRows(jsonData);
        res.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.attachment("data.xlsx");
        await workbook.xlsx.write(res);
      } catch (error) {
        return res.status(500).send("Error converting to Excel");
      }
      return;

    case "png":
      try {
        // Create a canvas instance
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext("2d");

        // Example drawing: Render JSON data as text on the canvas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000000";
        ctx.font = "20px Arial";
        ctx.fillText(JSON.stringify(jsonData, null, 2), 50, 50);

        // Convert canvas to PNG buffer
        const buffer = canvas.toBuffer("image/png");

        // Send PNG buffer as response
        res.header("Content-Type", "image/png");
        res.attachment("data.png");
        res.send(buffer);
      } catch (error) {
        console.error("Error converting to PNG:", error);
        return res.status(500).send("Error converting to PNG");
      }
      break;

    default:
      return res.status(400).send("Invalid format");
  }

  cache.set(cacheKey, result);
  res.send(result);

  // Cleanup: remove the uploaded file
  if (file) {
    fs.unlinkSync(file.path);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
