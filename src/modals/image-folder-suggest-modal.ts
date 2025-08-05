import { App, SuggestModal } from "obsidian";
import { t } from "../i18n";

export class ImageFolderSuggestModal extends SuggestModal<string> {
    onSubmit: (folderPath: string) => void;

    constructor(app: App, onSubmit: (folderPath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder(t("folder_path_placeholder"));
    }

    getSuggestions(query: string): string[] {
        if (query.trim() === "") {
            return [];
        }
        const folders = this.app.vault.getAllFolders();
        return folders
            .map((folder) => folder.path)
            .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
            .sort()
            .slice(0, 10);
    }

    renderSuggestion(folderPath: string, el: HTMLElement) {
        el.createEl("div", { text: folderPath });
    }

    onChooseSuggestion(folderPath: string, evt: MouseEvent | KeyboardEvent) {
        this.onSubmit(folderPath);
    }
}
