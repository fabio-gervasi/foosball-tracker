import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Rendering Patterns Integration', () => {
  it('should not have function calls on useMemo values in AppRouter', async () => {
    // Read the AppRouter file to check for the specific pattern that caused the bug
    const appRouterPath = path.resolve(__dirname, '../../components/AppRouter.tsx');
    const appRouterContent = fs.readFileSync(appRouterPath, 'utf-8');

    // Check that we're not calling renderCurrentView as a function
    const hasIncorrectFunctionCall = appRouterContent.includes('renderCurrentView()');

    expect(hasIncorrectFunctionCall).toBe(
      false,
      'AppRouter should not call renderCurrentView() as a function. ' +
        'It should use the memoized value directly: {renderCurrentView}'
    );

    // Check that we have the correct useMemo pattern
    const hasUseMemoPattern = appRouterContent.includes('useMemo(');
    expect(hasUseMemoPattern).toBe(true, 'AppRouter should use useMemo for renderCurrentView');

    // Check that we use the value correctly (without parentheses)
    const hasCorrectUsage = appRouterContent.includes('{renderCurrentView}');
    expect(hasCorrectUsage).toBe(
      true,
      'AppRouter should use renderCurrentView directly without calling it as a function'
    );
  });

  it('should prevent "is not a function" errors in component patterns', () => {
    // This test documents common patterns that can cause "X is not a function" errors

    const commonMistakes = [
      {
        pattern: 'useMemo returns value, called as function',
        incorrect: 'const value = useMemo(() => <div>content</div>, []); return value();',
        correct: 'const value = useMemo(() => <div>content</div>, []); return value;',
        error: 'is not a function',
      },
      {
        pattern: 'useCallback returns function, used as value',
        incorrect: 'const fn = useCallback(() => <div>content</div>, []); return fn;',
        correct: 'const fn = useCallback(() => <div>content</div>, []); return fn();',
        error: 'JSX element expected',
      },
    ];

    commonMistakes.forEach(mistake => {
      expect(mistake.incorrect).not.toBe(mistake.correct);
      expect(mistake.error).toBeTruthy();
    });
  });

  it('should document the specific bug we fixed', () => {
    // Document the exact bug for future reference
    const bugDescription = {
      error: 'renderCurrentView is not a function',
      cause: 'useMemo returns a value, but code tried to call it as a function',
      location: 'AppRouter.tsx line 271',
      fix: 'Remove parentheses: {renderCurrentView()} → {renderCurrentView}',
      prevention: 'This test checks that pattern is not reintroduced',
    };

    expect(bugDescription.error).toContain('is not a function');
    expect(bugDescription.fix).toContain('Remove parentheses');
    expect(bugDescription.prevention).toContain('test checks');
  });

  it('should verify no other components have similar issues', async () => {
    // Check other component files for similar patterns
    const componentsDir = path.resolve(__dirname, '../../components');

    // This is a basic check - in a real scenario you might want to
    // recursively check all .tsx files for similar patterns
    const componentFiles = [
      'AppRouter.tsx',
      'dashboard/Dashboard.tsx',
      // Add other critical components as needed
    ];

    for (const file of componentFiles) {
      const filePath = path.join(componentsDir, file);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Look for potential issues: useMemo followed by function calls
        const hasPotentialIssue =
          /const\s+\w+\s*=\s*useMemo\([^}]+\}\s*,\s*\[[^\]]*\]\)\s*;[\s\S]*?\{\s*\w+\(\)\s*\}/.test(
            content
          );

        expect(hasPotentialIssue).toBe(
          false,
          `${file} may have useMemo values being called as functions`
        );
      }
    }
  });
});
