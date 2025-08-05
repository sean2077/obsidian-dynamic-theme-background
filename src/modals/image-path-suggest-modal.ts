import { App, SuggestModal } from "obsidian";

export class ImagePathSuggestModal extends SuggestModal<string> {
    onSubmit: (imagePath: string) => void;

    constructor(app: App, onSubmit: (imagePath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder("https://example.com/image.jpg OR path/to/image.jpg");
    }

    getSuggestions(query: string): string[] {
        if (query.trim() === "") {
            return [];
        }
        if (query.startsWith("http://") || query.startsWith("https://") || query.startsWith("www.")) {
            return [];
        }
        const files = this.app.vault.getFiles();
        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];
        return files
            .filter((file) => imageExtensions.some((ext) => file.path.toLowerCase().endsWith(ext)))
            .map((file) => file.path)
            .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
            .sort()
            .slice(0, 10);
    }

    renderSuggestion(imagePath: string, el: HTMLElement) {
        const container = el.createDiv({ cls: "dtb-suggestion-item" });
        const icon = container.createSpan();
        icon.textContent = "🖼️";
        const text = container.createSpan();
        text.textContent = imagePath;
    }

    onChooseSuggestion(imagePath: string, evt: MouseEvent | KeyboardEvent) {
        this.onSubmit(imagePath);
    }
}
