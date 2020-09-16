// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands } from "vscode";
import { Commands, executeJavaLanguageServerCommand } from "../commands";
import { MainMethodInfo } from "../exportJar/ResolveMainMethodExecutor";
import { INodeData } from "./nodeData";

export namespace Jdtls {
    export function getProjects(params: string): Thenable<INodeData[]> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_PROJECT_LIST, params);
    }

    export function refreshLibraries(params: string): Thenable<boolean> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_PROJECT_REFRESH_LIB_SERVER, params);
    }

    export function getPackageData(params): Thenable<INodeData[]> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_GETPACKAGEDATA, params);
    }

    export function resolvePath(params: string): Thenable<INodeData[]> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_RESOLVEPATH, params);
    }

    export function getMainMethod(params: string): Thenable<MainMethodInfo[]> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_PROJECT_GETMAINMETHOD, params);
    }

    export function exportJar(mainMethod: string, elements: string[], destination: string): Thenable<boolean> {
        return commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.JAVA_PROJECT_GENERATEJAR, mainMethod, elements, destination);
    }

    export enum CompileWorkspaceStatus {
        Failed = 0,
        Succeed = 1,
        Witherror = 2,
        Cancelled = 3,
    }

    export function resolveBuildFiles(): Promise<string[]> {
        return <Promise<string[]>>executeJavaLanguageServerCommand(Commands.JAVA_RESOLVE_BUILD_FILES);
    }
}
