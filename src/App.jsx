import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  MenuItem,
  Typography,
  CssBaseline,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Switch,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import { Brightness4, Brightness7, Delete } from "@mui/icons-material";
import axios from "axios";
import FileDownload from "js-file-download";
import { styled } from "@mui/material/styles";
import yaml from "js-yaml";

const Input = styled("input")({
  display: "none",
});

const App = () => {
  const [file, setFile] = useState(null);
  const [inputText, setInputText] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [detectedFormat, setDetectedFormat] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setInputFormat(event.target.files[0].name.split(".").pop().toLowerCase());
    setInputText(""); // Clear text input when file is uploaded
    setDetectedFormat(""); // Clear detected format when file is uploaded
  };

  const handleRemoveFile = () => {
    setFile(null);
    setInputFormat("");
    setDetectedFormat("");
  };

  const handleTextChange = (event) => {
    const text = event.target.value;
    setInputText(text);
    setFile(null); // Clear file input when text is entered
    setDetectedFormat(detectTextFormat(text)); // Detect and set input format
  };

  const detectTextFormat = (text) => {
    try {
      JSON.parse(text);
      setInputFormat("json");
      return "JSON";
    } catch (e1) {
      try {
        if (text.trim().startsWith("<") && text.trim().endsWith(">")) {
          new DOMParser().parseFromString(text, "application/xml");
          setInputFormat("xml");
          return "XML";
        } else {
          throw new Error("Not XML");
        }
      } catch (e2) {
        try {
          yaml.load(text);
          setInputFormat("yaml");
          return "YAML";
        } catch (e3) {
          setInputFormat("");
          return "Unsupported format";
        }
      }
    }
  };

  const handleOutputFormatChange = (event) => {
    setOutputFormat(event.target.value);
  };

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    if (file) {
      formData.append("file", file);
      formData.append("inputFormat", inputFormat);
    } else {
      formData.append("data", inputText);
      formData.append("inputFormat", inputFormat);
    }
    formData.append("outputFormat", outputFormat);

    try {
      const response = await axios.post("http://localhost:5000/convert", formData, {
        responseType: "blob",
      });
      FileDownload(response.data, `converted_data.${outputFormat}`);
    } catch (error) {
      if (error.response && error.response.status === 429) {
        alert("Too Many Requests. Please try again later.");
      } else {
        alert("Invalid input!");
        console.error("Error converting data:", error);
      }
    }
  };

  const availableFormats = {
    json: ["csv", "xml", "yaml", "xlsx", "pdf", "png"],
    csv: ["json", "xml", "yaml", "xlsx"],
    xml: ["json", "yaml", "csv", "pdf", "xlsx"],
    yaml: ["json", "xml", "csv", "pdf", "xlsx"],
  };

  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      primary: {
        main: darkMode ? "#ffffff" : "#000000",
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Data Converter
          </Typography>
          <IconButton color="inherit" onClick={handleToggleDarkMode}>
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          <Switch checked={darkMode} onChange={handleToggleDarkMode} />
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm">
        <Paper style={{ padding: 16, marginTop: 32 }}>
          <Typography variant="h4" gutterBottom>
            Data Converter
          </Typography>
          <form onSubmit={handleSubmit}>
            <label htmlFor="file-upload">
              <Input accept=".json,.csv,.xml,.yaml,.yml" id="file-upload" type="file" onChange={handleFileChange} />
              <Button variant="contained" component="span" fullWidth>
                Upload File
              </Button>
            </label>
            {file && (
              <Typography variant="body1" style={{ marginTop: 16, display: "flex", alignItems: "center" }}>
                File: {file.name}
                <IconButton aria-label="delete" onClick={handleRemoveFile} style={{ marginLeft: 8 }}>
                  <Delete />
                </IconButton>
              </Typography>
            )}
            <Typography variant="body1" style={{ marginTop: 16 }}>
              OR
            </Typography>
            {detectedFormat && (
              <Typography variant="body2" style={{ marginTop: 8, color: "grey" }}>
                Detected Format: {detectedFormat}
              </Typography>
            )}
            <TextField
              label="Input Data"
              multiline
              rows={6}
              variant="outlined"
              fullWidth
              value={inputText}
              onChange={handleTextChange}
              margin="normal"
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
              {availableFormats[inputFormat] &&
                availableFormats[inputFormat].map((format) => (
                  <MenuItem key={format} value={format}>
                    {format.toUpperCase()}
                  </MenuItem>
                ))}
            </TextField>
            <Button variant="contained" color="primary" type="submit" fullWidth>
              Convert
            </Button>
          </form>
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default App;
