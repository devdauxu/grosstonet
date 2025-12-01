// Constants
const BASE_SALARY = 2340000;
const REGION_MIN_WAGE = {
    1: 4960000,
    2: 4410000,
    3: 3860000,
    4: 3250000
};

// Insurance Rates
const INSURANCE_RATES = {
    bhxh: 0.08,
    bhyt: 0.015,
    bhtn: 0.01
};

const INSURANCE_MAX_SALARY_BHXH_BHYT = 20 * BASE_SALARY; // Capped at 20 * Base Salary

// Tax Configuration
const TAX_CONFIG = {
    2025: {
        personalDeduction: 11000000,
        dependentDeduction: 4400000,
        brackets: [
            { max: 5000000, rate: 0.05, subtract: 0 },
            { max: 10000000, rate: 0.10, subtract: 250000 },
            { max: 18000000, rate: 0.15, subtract: 750000 },
            { max: 32000000, rate: 0.20, subtract: 1650000 },
            { max: 52000000, rate: 0.25, subtract: 3250000 },
            { max: 80000000, rate: 0.30, subtract: 5850000 },
            { max: Infinity, rate: 0.35, subtract: 9850000 }
        ]
    },
    2026: {
        personalDeduction: 15500000,
        dependentDeduction: 6200000,
        brackets: [
            { max: 10000000, rate: 0.05, subtract: 0 },
            { max: 30000000, rate: 0.10, subtract: 500000 },
            { max: 60000000, rate: 0.20, subtract: 3500000 },
            { max: 100000000, rate: 0.30, subtract: 9500000 },
            { max: Infinity, rate: 0.35, subtract: 14500000 }
        ]
    }
};

let currentYear = 2025;
let currentMode = 'gross-net'; // 'gross-net' or 'net-gross'
let isComparisonMode = false;

function switchYear(year) {
    isComparisonMode = false;
    currentYear = year;
    document.getElementById('btn-year-2025').classList.toggle('active', year === 2025);
    document.getElementById('btn-year-2026').classList.toggle('active', year === 2026);
    document.getElementById('btn-compare').classList.remove('active');

    // Show regular result, hide comparison
    document.getElementById('result-section').classList.remove('hidden');
    document.getElementById('comparison-section').classList.add('hidden');

    const config = TAX_CONFIG[year];
    const note = `Giảm trừ gia cảnh: Bản thân <strong>${formatCurrency(config.personalDeduction / 1000000)}tr</strong>/tháng, Phụ thuộc <strong>${formatCurrency(config.dependentDeduction / 1000000)}tr</strong>/tháng`;
    document.getElementById('policy-note').innerHTML = note;

    calculate();
}

function switchToCompare() {
    isComparisonMode = true;
    document.getElementById('btn-year-2025').classList.remove('active');
    document.getElementById('btn-year-2026').classList.remove('active');
    document.getElementById('btn-compare').classList.add('active');

    // Hide regular result, show comparison
    document.getElementById('result-section').classList.add('hidden');
    document.getElementById('comparison-section').classList.remove('hidden');

    document.getElementById('policy-note').innerHTML = 'So sánh chính sách Hiện hành (2025) và Dự thảo (2026)';

    calculateComparison();
}

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('btn-gross-net').classList.toggle('active', mode === 'gross-net');
    document.getElementById('btn-net-gross').classList.toggle('active', mode === 'net-gross');

    // Update label
    const incomeLabel = document.querySelector('label[for="income"]');
    if (mode === 'gross-net') {
        incomeLabel.textContent = 'Thu nhập Gross (VNĐ)';
    } else {
        incomeLabel.textContent = 'Thu nhập Net (VNĐ)';
    }

    calculate();
}

function toggleInsuranceInput() {
    const type = document.querySelector('input[name="insurance-base"]:checked').value;
    const input = document.getElementById('insurance-salary');
    if (type === 'other') {
        input.classList.remove('hidden');
    } else {
        input.classList.add('hidden');
    }
    calculate();
}

function formatCurrencyInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value) {
        value = parseInt(value, 10).toLocaleString('en-US');
        input.value = value;
    }
}

function parseCurrency(str) {
    return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function formatCurrency(num) {
    return num.toLocaleString('en-US');
}

function calculatePIT(taxableIncome) {
    if (taxableIncome <= 0) return 0;

    let totalTax = 0;
    const brackets = TAX_CONFIG[currentYear].brackets;
    for (let bracket of brackets) {
        if (taxableIncome <= bracket.max) {
            totalTax = taxableIncome * bracket.rate - bracket.subtract;
            break;
        }
    }
    return totalTax;
}

function getTaxBreakdown(taxableIncome) {
    if (taxableIncome <= 0) return [];

    const breakdown = [];
    let previousMax = 0;
    const brackets = TAX_CONFIG[currentYear].brackets;

    for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        const rate = bracket.rate;
        const currentMax = bracket.max; // This is the cumulative max (e.g. 5m, 10m)

        // The range for this bracket is (previousMax, currentMax]
        // But we need to know how much of the taxableIncome falls into this range.

        // Range size:
        // Level 1: 0 - 5m
        // Level 2: 5m - 10m
        // ...

        // Actually, simpler logic:
        // Calculate tax for this specific chunk.

        let incomeInBracket = 0;

        if (taxableIncome > previousMax) {
            const maxInThisBracket = (currentMax === Infinity ? taxableIncome : currentMax) - previousMax;
            const actualInThisBracket = Math.min(taxableIncome - previousMax, maxInThisBracket);

            if (actualInThisBracket > 0) {
                const tax = actualInThisBracket * rate;
                breakdown.push({
                    level: i + 1,
                    rate: rate * 100,
                    income: actualInThisBracket,
                    tax: tax,
                    label: `Đến ${currentMax === Infinity ? '...' : formatCurrency(currentMax)}`
                });
            }
        }

        previousMax = currentMax;
        if (taxableIncome <= previousMax) break;
    }

    return breakdown;
}

function calculate() {
    const income = parseCurrency(document.getElementById('income').value);
    const dependents = parseInt(document.getElementById('dependents').value) || 0;
    const region = document.querySelector('input[name="region"]:checked').value;
    const insuranceType = document.querySelector('input[name="insurance-base"]:checked').value;
    let insuranceSalaryInput = parseCurrency(document.getElementById('insurance-salary').value);

    if (income === 0) return;

    if (isComparisonMode) {
        calculateComparison();
        return;
    }

    let gross, net;

    if (currentMode === 'gross-net') {
        gross = income;
        const result = calculateFromGross(gross, dependents, region, insuranceType, insuranceSalaryInput);
        updateUI(result);
    } else {
        net = income;
        // Net to Gross is iterative or formula inversion. Iterative is safer for complex tax.
        // Or we can use the "converted income" method.
        const result = calculateFromNet(net, dependents, region, insuranceType, insuranceSalaryInput);
        updateUI(result);
    }
}

function calculateComparison() {
    const income = parseCurrency(document.getElementById('income').value);
    const dependents = parseInt(document.getElementById('dependents').value) || 0;
    const region = document.querySelector('input[name="region"]:checked').value;
    const insuranceType = document.querySelector('input[name="insurance-base"]:checked').value;
    let insuranceSalaryInput = parseCurrency(document.getElementById('insurance-salary').value);

    if (income === 0) return;

    // Calculate for 2025
    const savedYear = currentYear;
    currentYear = 2025;
    let result2025;
    if (currentMode === 'gross-net') {
        result2025 = calculateFromGross(income, dependents, region, insuranceType, insuranceSalaryInput);
    } else {
        result2025 = calculateFromNet(income, dependents, region, insuranceType, insuranceSalaryInput);
    }

    // Calculate for 2026
    currentYear = 2026;
    let result2026;
    if (currentMode === 'gross-net') {
        result2026 = calculateFromGross(income, dependents, region, insuranceType, insuranceSalaryInput);
    } else {
        result2026 = calculateFromNet(income, dependents, region, insuranceType, insuranceSalaryInput);
    }

    // Restore current year
    currentYear = savedYear;

    // Update comparison UI
    updateComparisonUI(result2025, result2026);
}

function updateComparisonUI(result2025, result2026) {
    // Gross
    document.getElementById('comp-gross-2025').textContent = formatCurrency(Math.round(result2025.gross));
    document.getElementById('comp-gross-2026').textContent = formatCurrency(Math.round(result2026.gross));
    const grossDiff = result2026.gross - result2025.gross;
    document.getElementById('comp-gross-diff').textContent = formatCurrency(Math.round(grossDiff));

    // Net
    document.getElementById('comp-net-2025').textContent = formatCurrency(Math.round(result2025.net));
    document.getElementById('comp-net-2026').textContent = formatCurrency(Math.round(result2026.net));
    const netDiff = result2026.net - result2025.net;
    const netDiffEl = document.getElementById('comp-net-diff');
    netDiffEl.textContent = (netDiff >= 0 ? '+' : '') + formatCurrency(Math.round(netDiff));
    netDiffEl.classList.toggle('positive', netDiff > 0);
    netDiffEl.classList.toggle('negative', netDiff < 0);

    // Tax
    document.getElementById('comp-tax-2025').textContent = formatCurrency(Math.round(result2025.pit));
    document.getElementById('comp-tax-2026').textContent = formatCurrency(Math.round(result2026.pit));
    const taxDiff = result2026.pit - result2025.pit;
    const taxDiffEl = document.getElementById('comp-tax-diff');
    taxDiffEl.textContent = (taxDiff >= 0 ? '+' : '') + formatCurrency(Math.round(taxDiff));
    taxDiffEl.classList.toggle('positive', taxDiff < 0); // Lower tax is positive
    taxDiffEl.classList.toggle('negative', taxDiff > 0); // Higher tax is negative
}

function calculateFromGross(gross, dependents, region, insuranceType, insuranceSalaryInput) {
    // 1. Calculate Insurance Salary Base
    let insuranceSalary = gross;
    if (insuranceType === 'other' && insuranceSalaryInput > 0) {
        insuranceSalary = insuranceSalaryInput;
    }

    // Cap BHXH/BHYT
    const cappedBhxhBhyt = Math.min(insuranceSalary, INSURANCE_MAX_SALARY_BHXH_BHYT);
    // Cap BHTN (Region based)
    const maxBhtn = 20 * REGION_MIN_WAGE[region];
    const cappedBhtn = Math.min(insuranceSalary, maxBhtn);

    const bhxh = cappedBhxhBhyt * INSURANCE_RATES.bhxh;
    const bhyt = cappedBhxhBhyt * INSURANCE_RATES.bhyt;
    const bhtn = cappedBhtn * INSURANCE_RATES.bhtn;
    const totalInsurance = bhxh + bhyt + bhtn;

    // 2. Calculate Taxable Income
    const preTaxIncome = gross - totalInsurance;
    const config = TAX_CONFIG[currentYear];
    const totalDeduction = config.personalDeduction + (dependents * config.dependentDeduction);
    const taxableIncome = Math.max(0, preTaxIncome - totalDeduction);

    // 3. Calculate PIT
    const pit = calculatePIT(taxableIncome);

    // 4. Net
    const net = gross - totalInsurance - pit;

    return {
        gross,
        net,
        bhxh,
        bhyt,
        bhtn,
        preTaxIncome,
        totalDeduction,
        taxableIncome,
        pit
    };
}

function calculateFromNet(net, dependents, region, insuranceType, insuranceSalaryInput) {
    // If insurance is on "Official Salary", Gross is unknown, so Insurance is unknown.
    // This requires iteration or solving equation: Net = Gross - Ins(Gross) - Tax(Gross - Ins(Gross) - Deductions)

    // If insurance is "Other" (Fixed), it's easier:
    // Net = Gross - FixedIns - Tax(Gross - FixedIns - Deductions)
    // => Gross - Tax(...) = Net + FixedIns. Convert Net+FixedIns to Taxable, then to Gross.

    // Let's use a simple iterative approach (Binary Search) to find Gross that yields the target Net.
    // Range: [Net, Net * 2] (Roughly)

    let low = net;
    let high = net * 2; // Initial guess
    let gross = net;
    let result;

    // Expand high if needed
    while (true) {
        result = calculateFromGross(high, dependents, region, insuranceType, insuranceSalaryInput);
        if (result.net > net) break;
        low = high;
        high *= 2;
        if (high > 10000000000) break; // Safety break
    }

    // Binary search
    for (let i = 0; i < 100; i++) { // Increased iterations for better precision
        gross = (low + high) / 2;
        result = calculateFromGross(gross, dependents, region, insuranceType, insuranceSalaryInput);

        if (Math.abs(result.net - net) < 1) {
            break;
        }

        if (result.net < net) {
            low = gross;
        } else {
            high = gross;
        }
    }

    // Force Net to match input if it's very close (rounding error)
    if (Math.abs(result.net - net) < 5) {
        result.net = net;
    }

    return result;
}

function updateUI(data) {
    document.getElementById('res-gross').textContent = formatCurrency(Math.round(data.gross));
    document.getElementById('res-net').textContent = formatCurrency(Math.round(data.net));
    document.getElementById('res-pit').textContent = formatCurrency(Math.round(data.pit));

    document.getElementById('detail-gross').textContent = formatCurrency(Math.round(data.gross));
    document.getElementById('detail-bhxh').textContent = formatCurrency(Math.round(data.bhxh));
    document.getElementById('detail-bhyt').textContent = formatCurrency(Math.round(data.bhyt));
    document.getElementById('detail-bhtn').textContent = formatCurrency(Math.round(data.bhtn));
    document.getElementById('detail-pre-tax').textContent = formatCurrency(Math.round(data.preTaxIncome));
    document.getElementById('detail-dependents').textContent = formatCurrency(Math.round(data.totalDeduction - TAX_CONFIG[currentYear].personalDeduction));
    document.getElementById('detail-taxable').textContent = formatCurrency(Math.round(data.taxableIncome));
    document.getElementById('detail-pit').textContent = formatCurrency(Math.round(data.pit));
    document.getElementById('detail-net').textContent = formatCurrency(Math.round(data.net));

    // Render Tax Breakdown
    const breakdown = getTaxBreakdown(data.taxableIncome);
    const container = document.getElementById('pit-details-container');
    const tbody = document.querySelector('#pit-details-table tbody');

    if (breakdown.length > 0) {
        container.classList.remove('hidden');
        tbody.innerHTML = breakdown.map(item => `
            <tr>
                <td>Bậc ${item.level} (${item.rate}%)</td>
                <td class="text-right">${formatCurrency(Math.round(item.income))}</td>
                <td class="text-right">${formatCurrency(Math.round(item.tax))}</td>
            </tr>
        `).join('');
    } else {
        container.classList.add('hidden');
    }
}

// Initial call
calculate();
