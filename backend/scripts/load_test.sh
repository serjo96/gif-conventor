#!/bin/bash

# Определяем директорию скрипта
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Пути к лог-файлам
LOG_DIR="${SCRIPT_DIR}/logs"
UPLOAD_ERRORS_LOG="${LOG_DIR}/upload_errors.log"
CONVERSION_LOG="${LOG_DIR}/conversion.log"

# Значения по умолчанию
TOTAL_JOBS=100
CONCURRENT_JOBS=10
BASE_URL="http://localhost:3000"
TEST_FILE="${SCRIPT_DIR}/7s_1024x768.mp4"

# Создаем директорию для логов
mkdir -p "$LOG_DIR"

# Массивы для отслеживания статусов
declare -a PENDING_JOBS=()
declare -a COMPLETED_JOBS=()
declare -a FAILED_JOBS=()

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Создаем временные файлы
setup_temp_files() {
    : > "$UPLOAD_ERRORS_LOG"
    : > "$CONVERSION_LOG"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create log files${NC}"
        exit 1
    fi
}

# Проверяем наличие тестового файла
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ Test file $TEST_FILE not found!${NC}"
    echo -e "${RED}Please place 7s_1024x768.mp4 in: ${SCRIPT_DIR}${NC}"
    exit 1
fi

# Проверка зависимостей
check_dependencies() {
    local missing_deps=()

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing_deps[*]}${NC}"
        exit 1
    fi
}

# Вызываем проверку зависимостей
check_dependencies

# Вызываем после check_dependencies
setup_temp_files

# Функция для отправки файла
upload_file() {
    local job_number=$1
    local start_time=$(date +%s.%N)

    echo -e "${BLUE}📤 [$job_number/$TOTAL_JOBS] Uploading...${NC}"

    local response=$(curl -s -w "\\n%{http_code}" -X POST \
        -F "video=@${TEST_FILE}" \
        "${BASE_URL}/api/conversion/upload")

    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        echo -e "${RED}❌ Upload failed for job $job_number with HTTP code $http_code${NC}"
        echo -e "${RED}Response: $response_body${NC}"
        echo "Job $job_number: $response_body" >> "$UPLOAD_ERRORS_LOG"
        return 1
    fi

    # Извлекаем jobId из ответа
    local job_id=$(echo "$response_body" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$job_id" ]; then
        echo "$job_id" >> "$LOG_DIR/pending_jobs.txt"
        echo -e "${GREEN}✅ Job $job_number uploaded with jobId: $job_id${NC}"
    else
        echo -e "${RED}❌ Failed to extract jobId from response${NC}"
        return 1
    fi

    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    echo -e "${GREEN}⏱️ Upload time: ${duration}s${NC}"
}

# Запускаем загрузки
echo -e "\n${BLUE}🏃 Starting uploads...${NC}"
upload_start_time=$(date +%s)

: > "$LOG_DIR/pending_jobs.txt"  # Очищаем файл перед загрузками

for i in $(seq 1 $TOTAL_JOBS); do
    while [ $(jobs -p | wc -l) -ge $CONCURRENT_JOBS ]; do
        sleep 0.1
    done
    upload_file "$i" &
done

wait  # Ждем завершения всех загрузок

# Загружаем jobId в массив
PENDING_JOBS=()
while IFS= read -r job_id; do
    [ -n "$job_id" ] && PENDING_JOBS+=("$job_id")
done < "$LOG_DIR/pending_jobs.txt"

upload_end_time=$(date +%s)
upload_total_time=$((upload_end_time - upload_start_time))

echo -e "\n${BLUE}📊 Upload Results:${NC}"
echo -e "Total upload time: ${upload_total_time}s"
echo -e "Uploaded files: ${#PENDING_JOBS[@]}"
echo -e "Failed uploads: $((TOTAL_JOBS - ${#PENDING_JOBS[@]}))"

# Проверяем успешность загрузок
if [ ${#PENDING_JOBS[@]} -eq 0 ]; then
    echo -e "${RED}❌ All uploads failed! Check ${UPLOAD_ERRORS_LOG} for details.${NC}"
    exit 1
fi

# Функция для проверки статусов
check_statuses() {
    local job_ids_json=$(printf '%s\n' "${PENDING_JOBS[@]}" | jq -R . | jq -s .)
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jobIds\": $job_ids_json}" \
        "${BASE_URL}/api/conversion/status")

    # Проверяем валидность JSON ответа
    if ! echo "$response" | jq empty 2>/dev/null; then
        echo -e "${RED}❌ Invalid JSON response from API${NC}"
        echo "Response: $response" >> "$CONVERSION_LOG"
        return 1
    fi

    echo "$response"
}

# Ожидание завершения обработки
processing_start_time=$(date +%s)
while [ ${#PENDING_JOBS[@]} -gt 0 ]; do
    status_response=$(check_statuses)
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to get status update${NC}"
        sleep 5
        continue
    fi

    new_pending=()

    # Проверяем, что ответ содержит массив статусов
    if ! echo "$status_response" | jq -e 'type == "array"' >/dev/null; then
        echo -e "${RED}❌ Unexpected API response format${NC}"
        echo "Response: $status_response" >> "$CONVERSION_LOG"
        sleep 5
        continue
    fi

    while IFS= read -r job; do
        # Пропускаем пустые строки
        [ -z "$job" ] && continue

        job_id=$(echo "$job" | jq -r '.jobId // empty')
        status=$(echo "$job" | jq -r '.status // empty')

        # Проверяем, что получили необходимые данные
        if [ -z "$job_id" ] || [ -z "$status" ]; then
            echo -e "${RED}❌ Invalid job data: $job${NC}" >> "$CONVERSION_LOG"
            continue
        fi

        case "$status" in
            "completed")
                COMPLETED_JOBS+=("$job_id")
                echo -e "${GREEN}✅ Job $job_id completed${NC}"
                echo "$(date '+%Y-%m-%d %H:%M:%S') - Job $job_id completed" >> "$CONVERSION_LOG"
                ;;
            "failed")
                FAILED_JOBS+=("$job_id")
                echo -e "${RED}❌ Job $job_id failed${NC}"
                echo "$(date '+%Y-%m-%d %H:%M:%S') - Job $job_id failed" >> "$CONVERSION_LOG"
                ;;
            *)
                new_pending+=("$job_id")
                ;;
        esac
    done < <(echo "$status_response" | jq -c '.[]')

    PENDING_JOBS=("${new_pending[@]}")

    if [ ${#PENDING_JOBS[@]} -gt 0 ]; then
        echo -e "${BLUE}⏳ Waiting for ${#PENDING_JOBS[@]} jobs...${NC}"
        sleep 5
    fi
done

processing_end_time=$(date +%s)
processing_total_time=$((processing_end_time - processing_start_time))

echo -e "\n${BLUE}📊 Processing Time:${NC} ${processing_total_time}s"

if [ $processing_total_time -eq 0 ]; then
    echo -e "${RED}⚠️  Warning: No jobs were processed!${NC}"
    exit 1
fi

echo -e "Processing speed: $(echo "scale=2; ${#COMPLETED_JOBS[@]}/$processing_total_time" | bc) jobs/sec"

# Обновляем финальный вывод:
echo -e "\n${BLUE}📊 Final Results:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "⏱️  Time Statistics:"
echo -e "   Upload time:     ${upload_total_time}s"
echo -e "   Processing time: ${processing_total_time}s"
echo -e "   Total time:      $((upload_total_time + processing_total_time))s"
echo -e ""
echo -e "📈 Job Statistics:"
echo -e "   Total jobs:      $TOTAL_JOBS"
echo -e "   Completed:       ${#COMPLETED_JOBS[@]}"
echo -e "   Failed:          ${#FAILED_JOBS[@]}"
echo -e "   Success rate:    $(( ${#COMPLETED_JOBS[@]} * 100 / TOTAL_JOBS ))%"
echo -e ""
echo -e "🚀 Performance:"
echo -e "   Upload speed:    $(echo "scale=2; $TOTAL_JOBS/$upload_total_time" | bc) jobs/sec"
echo -e "   Process speed:   $(echo "scale=2; ${#COMPLETED_JOBS[@]}/$processing_total_time" | bc) jobs/sec"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILED_JOBS[@]} -gt 0 ]; then
    echo -e "\n${RED}⚠️  Warning: Some jobs failed!${NC}"
    echo -e "Check ${CONVERSION_LOG} for details."
fi
