// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ExportJarStep, IStepMetadata } from "../exportJarFileCommand";

export interface IExportJarStepExecutor {
    execute(stepMetadata?: IStepMetadata): Promise<ExportJarStep>;
}
