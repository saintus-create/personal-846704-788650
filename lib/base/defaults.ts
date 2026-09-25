import type { BaseSuggestionIconId } from "@/lib/base/preview-schema";

export type BaseSuggestionOption = {
  label: string;
  prompt: string;
};

export type BaseSuggestionGroup = {
  label: string;
  icon: BaseSuggestionIconId;
  options: BaseSuggestionOption[];
};

export type BaseSlashCommand = {
  id: string;
  description: string;
  icon: string;
};

export type BaseBrandTheme = {
  background: string;
  text: string;
  surface: string;
  accent: string;
};

export type ResolvedBaseConfig = {
  assistant: {
    appName: string;
    labels: {
      newChat: string;
      composerPlaceholder: string;
    };
    welcome: {
      headline: string;
      body?: string | null;
    };
    suggestionGroups: BaseSuggestionGroup[];
    slashCommands: BaseSlashCommand[];
  };
  brandTheme: BaseBrandTheme;
};

export const defaultBaseConfig: ResolvedBaseConfig = {
  assistant: {
    appName: "California Legislative Information",
    labels: {
      newChat: "New chat",
      composerPlaceholder: "Ask anything about California law…",
    },
    welcome: {
      headline: "California law, answered.",
      body: "The complete California Codes, 2025-26 bills, Rules of Court, and case law — cited inline.",
    },
    suggestionGroups: [
      {
        label: "Statutes",
        icon: "search",
        options: [
          { label: "Burglary vs. robbery", prompt: "What is the difference between burglary and robbery in California?" },
          { label: "PI statute of limitations", prompt: "What is the statute of limitations for personal injury in California?" },
          { label: "Landlord entry rules", prompt: "When can a landlord enter a rental unit in California?" },
        ],
      },
      {
        label: "Research",
        icon: "analyze",
        options: [
          { label: "At-will exceptions", prompt: "What are the exceptions to at-will employment in California?" },
          { label: "2025-26 wildfire bills", prompt: "What wildfire-related bills did the Legislature pass in the 2025-26 session?" },
          { label: "Continuance rules", prompt: "What do the California Rules of Court say about continuances in civil trials?" },
        ],
      },
    ],
    slashCommands: [],
  },
  brandTheme: {
    background: "#000000",
    text: "#ececec",
    surface: "#212121",
    accent: "#4c8dff",
  },
};
