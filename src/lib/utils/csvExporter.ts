// src/utils/exportSurvey.ts

/**
 * Internet Explorer는 표준 `navigator` 객체에 `msSaveBlob`이라는 비표준 속성을 사용합니다.
 * TypeScript는 이 속성을 기본적으로 알지 못하므로, `Navigator` 인터페이스를 확장하여
 * `msSaveBlob` 속성이 존재함을 TypeScript 컴파일러에게 알려줍니다.
 * `?`는 이 속성이 선택적(optional)임을 의미합니다.
 */
interface MSNavigator extends Navigator {
    msSaveBlob?: (blob: Blob, defaultName?: string) => boolean;
}

/**
 * 2차원 배열 데이터를 받아 CSV 파일로 변환하고 사용자가 다운로드할 수 있도록 하는 함수입니다.
 * @param filename - 다운로드될 파일의 이름 (예: "survey_results_analysis_2025-10-02_13-00-00.csv")
 * @param rows - CSV로 변환할 데이터. 첫 번째 배열은 헤더(머리글)여야 합니다.
 */
export const exportToCsv = (filename: string, rows: (string | number)[][]) => {
    /**
     * 단일 행(1차원 배열)을 CSV 형식의 한 줄 문자열로 변환하는 내부 함수입니다.
     * @param row - CSV의 한 행에 해당하는 데이터 배열
     */
    const processRow = (row: (string | number)[]) => {
        let finalVal = '';
        // 행의 각 셀(데이터)을 순회합니다.
        for (let j = 0; j < row.length; j++) {
            // 셀 값이 null 또는 undefined이면 빈 문자열로 처리합니다.
            let innerValue = row[j] === null || row[j] === undefined ? '' : String(row[j]);

            // RFC 4180 표준에 따라, 셀 데이터에 쉼표(,)나 큰따옴표(")가 포함된 경우,
            // 전체 데이터를 큰따옴표로 감싸고, 내부의 큰따옴표는 두 개로 이스케이프 처리합니다.
            if (/[",]/.test(innerValue)) {
                innerValue = `"${innerValue.replace(/"/g, '""')}"`;
            }

            // 첫 번째 열이 아닌 경우, 앞에 쉼표를 추가하여 열을 구분합니다.
            if (j > 0) {
                finalVal += ',';
            }

            // 처리된 셀 값을 최종 문자열에 추가합니다.
            finalVal += innerValue;
        }
        // 행의 끝에 줄바꿈 문자를 추가하여 다음 행과 구분합니다.
        return finalVal + '\n';
    };

    // 모든 행을 `processRow` 함수를 이용해 CSV 문자열로 변환한 후, 하나의 파일 내용으로 합칩니다.
    // `\uFEFF` (UTF-8 BOM)을 파일 맨 앞에 추가하여 Excel에서 한글이 깨지지 않도록 합니다.
    const csvFile = '\uFEFF' + rows.map(processRow).join('');

    // 생성된 CSV 문자열을 'Blob' 객체로 변환합니다. Blob은 파일과 같은 바이너리 데이터를 나타냅니다.
    // `type`을 'text/csv;charset=utf-8;'로 지정하여 브라우저가 이 파일을 CSV로 인식하도록 합니다.
    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });

    // 다운로드를 트리거하기 위해 보이지 않는 <a>(앵커) 태그를 동적으로 생성합니다.
    const link = document.createElement('a');

    // --- 브라우저 호환성 처리 ---

    // 확장된 `MSNavigator` 타입으로 `navigator` 객체를 타입 캐스팅합니다.
    const nav = navigator as MSNavigator;

    // Internet Explorer 10 이상인 경우 `msSaveBlob` 메서드를 사용하여 파일을 저장합니다.
    if (nav.msSaveBlob) {
        nav.msSaveBlob(blob, filename);
    }
    // 그 외 최신 브라우저(Chrome, Firefox, Safari 등)의 경우
    else if (link.download !== undefined) {
        // `URL.createObjectURL`을 사용해 Blob 데이터를 가리키는 임시 URL을 생성합니다.
        const url = URL.createObjectURL(blob);
        // <a> 태그의 `href` 속성에 임시 URL을 설정합니다.
        link.setAttribute('href', url);
        // `download` 속성에 파일명을 지정하여, 링크 클릭 시 이동 대신 다운로드가 일어나도록 합니다.
        link.setAttribute('download', filename);
        // <a> 태그를 화면에 보이지 않게 처리합니다.
        link.style.visibility = 'hidden';
        // <a> 태그를 문서에 추가합니다.
        document.body.appendChild(link);
        // JavaScript로 <a> 태그를 클릭하여 파일 다운로드를 실행합니다.
        link.click();
        // 다운로드가 시작된 후에는 더 이상 필요 없는 <a> 태그를 문서에서 제거합니다.
        document.body.removeChild(link);
        // 생성했던 임시 URL을 해제하여 메모리 누수를 방지합니다.
        URL.revokeObjectURL(url);
    }
};