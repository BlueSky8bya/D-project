// src/types/papaparse.d.ts

declare module "papaparse" {
  export interface ParseResult<T = any> {
    data: T[];
    errors: any[];
    meta: any;
  }

  export interface ParseConfig<T = any> {
    header?: boolean;
    dynamicTyping?: boolean | Record<string, boolean>;
    skipEmptyLines?: boolean | "greedy";
    worker?: boolean; // ✅ 브라우저 워커 옵션
    complete?: (results: ParseResult<T>) => void;
    error?: (err: any) => void;
  }

  // 최소 기능만 선언 (문자열/파일 입력)
  const Papa: {
    parse<T = any>(input: string | File, config?: ParseConfig<T>): void;
  };

  export default Papa;
}
