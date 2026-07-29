// CANARY BRANCH FILE - throwaway, never merged.
import { stripScripts } from './canary-sanitize.js';

console.log('CANARY-SANITIZE-EXECUTED');
const out = stripScripts('hello<script>alert(1)</script>world');
if (out.includes('<script>')) {
  throw new Error(`sanitiser did not strip the script tag: got ${out}`);
}
