import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  MenuItem,
  Typography,
} from "@mui/material";
import axios from "axios";
import FileDownload from "js-file-download";

const App = () => {
  const [inputData, setInputData] = useState("");
  const [inputFile, setInputFile] = useState(null);
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [availableFormats, setAvailableFormats] = useState([
    "csv",
    "xml",
    "yaml",
    "pdf",
    "xlsx",
    "png",
  ]);

  const handleInputDataChange = (event) => {
    setInputData(event.target.value);
    setInputFile(null);
    setInputFormat("json");
    setAvailableFormats(["csv", "xml", "yaml", "pdf", "xlsx", "png"]);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExtension = file.name.split(".").pop().toLowerCase();
      setInputFile(file);
      setInputData("");
      setInputFormat(fileExtension);
      const formats = ["csv", "xml", "yaml", "pdf", "xlsx", "png"].filter(
        (fmt) => fmt !== fileExtension
      );
      setAvailableFormats(formats);
    }
  };

  const handleOutputFormatChange = (event) => {
    setOutputFormat(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData();
      if (inputFile) {
        formData.append("file", inputFile);
      } else {
        formData.append("data", inputData);
        formData.append("inputFormat", inputFormat);
      }
      formData.append("outputFormat", outputFormat);

      const response = await axios.post("http://localhost:5000/convert", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseType: "blob",
      });

      FileDownload(response.data, `converted_data.${outputFormat}`);
    } catch (error) {
      if (error.response.status === 429) {
        alert("Too Many Requests. Please try again later");
      } else {
        alert("Invalid Data!");
        console.error("Error converting data:", error);
      }
    }
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Data Converter
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Input Data"
          multiline
          rows={6}
          variant="outlined"
          fullWidth
          value={inputData}
          onChange={handleInputDataChange}
          margin="normal"
          disabled={inputFile !== null}
        />
        <input
          type="file"
          accept=".json,.xml,.yaml,.csv,.xlsx"
          onChange={handleFileChange}
          style={{ display: "block", margin: "20px 0" }}
        />
        <TextField
          select
          label="Output Format"
          value={outputFormat}
          onChange={handleOutputFormatChange}
          variant="outlined"
          fullWidth
          margin="normal"
        >
          {availableFormats.map((fmt) => (
            <MenuItem key={fmt} value={fmt}>
              {fmt.toUpperCase()}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" color="primary" type="submit" fullWidth>
          Convert
        </Button>
      </form>
    </Container>
  );
};

export default App;
