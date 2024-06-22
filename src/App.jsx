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
  const [jsonData, setJsonData] = useState("");
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("");

  const handleJsonDataChange = (event) => {
    setJsonData(event.target.value);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleFormatChange = (event) => {
    setFormat(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("data", jsonData);
      }
      formData.append("format", format);

      const response = await axios.post("http://localhost:5000/convert", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseType: "blob",
      });

      FileDownload(response.data, `converted_data.${format}`);
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
          label="JSON Data"
          multiline
          rows={6}
          variant="outlined"
          fullWidth
          value={jsonData}
          onChange={handleJsonDataChange}
          margin="normal"
          disabled={file !== null}
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
          value={format}
          onChange={handleFormatChange}
          variant="outlined"
          fullWidth
          margin="normal"
        >
          <MenuItem value="csv">CSV</MenuItem>
          <MenuItem value="xml">XML</MenuItem>
          <MenuItem value="yaml">YAML</MenuItem>
          <MenuItem value="pdf">PDF</MenuItem>
          <MenuItem value="xlsx">Excel</MenuItem>
          <MenuItem value="png">PNG</MenuItem>
        </TextField>
        <Button variant="contained" color="primary" type="submit" fullWidth>
          Convert
        </Button>
      </form>
    </Container>
  );
};

export default App;
