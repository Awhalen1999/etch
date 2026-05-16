// etch — entry point.
//
// All the real logic lives in ui/app.tsx. This file just mounts it.

import React from "react";
import { render } from "ink";

import { App } from "./ui/app";

render(<App />);
