// ---------------------------------------------------------------------------
// Starter templates for the New Project wizard
// ---------------------------------------------------------------------------

export interface TemplateInput {
  label: string;
  type: 'text' | 'textarea' | 'select';
  value?: string;
  placeholder?: string;
  options?: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  simpleDescription: string;
  badge?: 'popular' | 'advanced';
  inputs: TemplateInput[];
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'website',
    name: 'Website',
    icon: '\uD83C\uDF10',
    color: '#4285F4',
    description: 'A modern website with pages, styling, and responsive design',
    simpleDescription: 'Create a website that looks great on any device',
    badge: 'popular',
    inputs: [
      {
        label: 'What is this website for?',
        type: 'textarea',
        placeholder: 'e.g., A portfolio to showcase my photography work',
      },
      {
        label: 'Tech Stack',
        type: 'select',
        value: 'Next.js',
        options: ['Next.js', 'React', 'Vue', 'HTML/CSS only', 'Not sure \u2014 pick for me'],
      },
      {
        label: 'Design Style',
        type: 'select',
        value: 'Modern',
        options: ['Modern', 'Minimal', 'Playful', 'Corporate', 'Not sure'],
      },
      {
        label: 'Pages',
        type: 'textarea',
        value: 'Home, About, Contact',
        placeholder: 'List the pages you want',
      },
    ],
  },
  {
    id: 'mobile-app',
    name: 'Mobile App',
    icon: '\uD83D\uDCF1',
    color: '#10A37F',
    description: 'A cross-platform mobile app for iOS and Android',
    simpleDescription: 'Create an app that works on iPhones and Android phones',
    inputs: [
      {
        label: 'What does this app do?',
        type: 'textarea',
        placeholder: 'e.g., A to-do list app that sends reminders',
      },
      {
        label: 'Tech Stack',
        type: 'select',
        value: 'React Native',
        options: ['React Native', 'Flutter', 'Expo', 'Not sure \u2014 pick for me'],
      },
      {
        label: 'Key Features',
        type: 'textarea',
        placeholder: 'List the main features you want',
      },
      {
        label: 'Platform',
        type: 'select',
        value: 'Both',
        options: ['iOS only', 'Android only', 'Both'],
      },
    ],
  },
  {
    id: 'game',
    name: 'Game',
    icon: '\uD83C\uDFAE',
    color: '#D97706',
    description: 'A game \u2014 from simple browser games to complex projects',
    simpleDescription: 'Create a game you can play in your browser or on your computer',
    badge: 'popular',
    inputs: [
      {
        label: 'What kind of game?',
        type: 'textarea',
        placeholder: 'e.g., A 2D platformer where you play as a cat',
      },
      {
        label: 'Game Type',
        type: 'select',
        value: 'Browser (HTML5)',
        options: [
          'Browser (HTML5)',
          'Desktop (Unity)',
          'Desktop (Godot)',
          'Terminal/Text-based',
          'Not sure \u2014 pick for me',
        ],
      },
      {
        label: 'Art Style',
        type: 'select',
        value: 'Pixel art',
        options: ['Pixel art', '2D drawn', '3D low-poly', 'Text only', 'No preference'],
      },
      {
        label: 'Features',
        type: 'textarea',
        placeholder: 'e.g., Multiple levels, high score system, sound effects',
      },
    ],
  },
  {
    id: 'api',
    name: 'API / Backend',
    icon: '\u26A1',
    color: '#534AB7',
    description: 'A server that handles data, logic, and connections to other services',
    simpleDescription: 'Create the behind-the-scenes engine that powers an app',
    badge: 'advanced',
    inputs: [
      {
        label: 'What should this API do?',
        type: 'textarea',
        placeholder: 'e.g., Manage user accounts and store blog posts',
      },
      {
        label: 'Tech Stack',
        type: 'select',
        value: 'Express (Node.js)',
        options: [
          'Express (Node.js)',
          'FastAPI (Python)',
          'Django (Python)',
          'Flask (Python)',
          'Go',
          'Not sure \u2014 pick for me',
        ],
      },
      {
        label: 'Database',
        type: 'select',
        value: 'PostgreSQL',
        options: ['PostgreSQL', 'MongoDB', 'SQLite', 'MySQL', 'None needed', 'Not sure'],
      },
      {
        label: 'Features',
        type: 'textarea',
        placeholder: 'e.g., User authentication, REST endpoints, file uploads',
      },
    ],
  },
  {
    id: 'chrome-extension',
    name: 'Chrome Extension',
    icon: '\uD83E\uDDE9',
    color: '#993556',
    description: 'A browser extension that adds features to Chrome',
    simpleDescription: 'Create an add-on that gives your browser superpowers',
    inputs: [
      {
        label: 'What should this extension do?',
        type: 'textarea',
        placeholder: 'e.g., Block distracting websites during work hours',
      },
      {
        label: 'Extension Type',
        type: 'select',
        value: 'Popup + Background',
        options: [
          'Popup only',
          'Popup + Background',
          'Content script (modifies pages)',
          'Full sidebar',
          'Not sure \u2014 pick for me',
        ],
      },
      {
        label: 'Permissions needed',
        type: 'textarea',
        placeholder: 'e.g., Access to all websites, storage, notifications',
      },
      {
        label: 'Key Features',
        type: 'textarea',
        placeholder: 'e.g., Settings page, daily statistics, whitelist',
      },
    ],
  },
  {
    id: 'scratch',
    name: 'Start from Scratch',
    icon: '\uD83D\uDD27',
    color: '#5F5E5A',
    description: 'A blank project \u2014 you decide everything',
    simpleDescription: 'Start with a clean slate and build anything you want',
    inputs: [],
  },
];
