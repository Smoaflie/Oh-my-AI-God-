// ==UserScript==
// @name         淘宝订单导出工具 (最终优化版)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  手动开启，勾选框位置优化，更稳定。在淘宝“已买到的宝贝”页面，点击“开启”按钮后，通过勾选框选择商品，并将其信息导出为JSON格式。
// @author       Gemini
// @match        https://buyertrade.taobao.com/trade/itemlist/*
// @grant        GM_addStyle
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 添加自定义样式 ---
    GM_addStyle(`
        .export-tool-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #FF5000;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .export-tool-btn:hover {
            background-color: #e04000;
        }
        /* 商品前的勾选框样式 */
        .item-checkbox {
            margin-right: 15px;
            transform: scale(1.5);
            cursor: pointer;
        }
        /* 订单详情旁的勾选框样式 (新位置) */
        .order-checkbox {
            margin-left: 10px; /* 和 "订单详情" 拉开距离 */
            transform: scale(1.5);
            cursor: pointer;
        }
        /* 确保商品勾选框垂直居中 */
        div[class*="itemInfo--"] {
            display: flex;
            align-items: center;
        }
        /* 确保包含“订单详情”的容器内的所有元素都垂直居中 */
        div[class*="button-container--"] {
            display: flex;
            align-items: center;
        }
    `);

    // --- 2. 创建初始的“开启”按钮 ---
    const startButton = document.createElement('button');
    startButton.innerText = '开启订单导出';
    startButton.className = 'export-tool-btn';
    startButton.id = 'start-export-tool-btn';
    document.body.appendChild(startButton);

    // --- 3. 创建“导出”按钮，但默认隐藏 ---
    const exportButton = document.createElement('button');
    exportButton.innerText = '导出选中订单';
    exportButton.className = 'export-tool-btn';
    exportButton.id = 'export-selected-btn';
    exportButton.style.display = 'none';
    document.body.appendChild(exportButton);

    // --- 4. 核心激活函数 ---
    function activateTool() {
        console.log("订单导出工具已激活，开始注入勾选框...");
        injectCheckboxes();
        addCheckboxEventListeners();
        exportButton.style.display = 'block';
        startButton.style.display = 'none';
    }

    // --- 5. 注入勾选框的函数 (位置优化) ---
    function injectCheckboxes() {
        const orders = document.querySelectorAll('div[id^="shopOrderContainer_"]');
        orders.forEach(order => {
            if (order.querySelector('.order-checkbox')) return;

            // --- 订单勾选框注入逻辑 (新) ---
            const shopInfo = order.querySelector('div[data-spm="shop"]');
            if (shopInfo) {
                // 精确查找 "订单详情" 链接
                const detailLink = shopInfo.querySelector('div[class*="shopInfoLeft--"]');
                if (detailLink) {
                    const orderCheckbox = document.createElement('input');
                    orderCheckbox.type = 'checkbox';
                    orderCheckbox.className = 'order-checkbox';
                    // 使用 insertAdjacentElement 插入到链接后面
                    detailLink.appendChild(orderCheckbox);
                }
            }

            // --- 商品勾选框注入逻辑 (不变) ---
            const items = order.querySelectorAll('div[class*="itemInfo--"]');
            items.forEach(item => {
                if (item.querySelector('.item-checkbox')) return;
                const itemCheckbox = document.createElement('input');
                itemCheckbox.type = 'checkbox';
                itemCheckbox.className = 'item-checkbox';
                item.insertBefore(itemCheckbox, item.firstChild);
            });
        });
    }

    // --- 6. 勾选框联动逻辑 (健壮版) ---
    function addCheckboxEventListeners() {
        document.querySelectorAll('.order-checkbox').forEach(orderCheckbox => {
            orderCheckbox.addEventListener('click', function() {
                const orderContainer = this.closest('div[id^="shopOrderContainer_"]');
                console.log(orderContainer);
                if (!orderContainer) return;
                const itemCheckboxes = orderContainer.querySelectorAll('.item-checkbox');
                this.indeterminate = false;
                itemCheckboxes.forEach(cb => {cb.checked = this.checked});
            });
        });

        document.querySelectorAll('.item-checkbox').forEach(itemCheckbox => {
            itemCheckbox.addEventListener('click', function() {
                const orderContainer = this.closest('div[id^="shopOrderContainer_"]');
                if (!orderContainer) return;
                const orderCheckbox = orderContainer.querySelector('.order-checkbox');
                if (!orderCheckbox) return;

                const itemCheckboxes = orderContainer.querySelectorAll('.item-checkbox');
                const totalItems = itemCheckboxes.length;
                const checkedItems = orderContainer.querySelectorAll('.item-checkbox:checked').length;

                if (checkedItems === 0) {
                    orderCheckbox.checked = false;
                    orderCheckbox.indeterminate = false;
                } else if (checkedItems === totalItems) {
                    orderCheckbox.checked = true;
                    orderCheckbox.indeterminate = false;
                } else {
                    orderCheckbox.checked = false;
                    orderCheckbox.indeterminate = true;
                }
            });
        });
    }

    // --- 7. 数据提取与导出函数 (健壮版) ---
    function exportSelectedOrders() {
        const results = [];
        const checkedItems = document.querySelectorAll('.item-checkbox:checked');

        if (checkedItems.length === 0) {
            alert('请至少选择一个要导出的商品。');
            return;
        }

        checkedItems.forEach(itemCheckbox => {
            try {
                const orderElement = itemCheckbox.closest('div[id^="shopOrderContainer_"]');
                const itemElement = itemCheckbox.closest('div[class*="itemInfo--"]');

                if (!orderElement || !itemElement) {
                    console.warn('跳过一个结构异常的商品项:', itemCheckbox);
                    return;
                }
                const shopElement = orderElement.querySelector('a[class*="shopInfoName--"]');
                const shop_info = shopElement ? shopElement.textContent.trim() : '';

                const order_id = orderElement.id.replace('shopOrderContainer_', '');
                const dateElement = orderElement.querySelector('span[class*="shopInfoOrderTime--"]');
                const order_date = dateElement ? dateElement.textContent.trim().split(' ')[0] : '未知日期';
                const allItemsInOrder = Array.from(orderElement.querySelectorAll('div[class*="itemInfo--"]'));
                const item_id = allItemsInOrder.indexOf(itemElement) + 1;
                const nameElement = itemElement.querySelector('a[class*="title--"]');
                const item_name = nameElement ? nameElement.textContent.trim() : '未知商品';
                const item_url = nameElement ? nameElement.href : '';
                const styleElement = itemElement.querySelector('div[class*="infoContent--"]');
                const item_style = styleElement ? styleElement.textContent.trim() : '';

                let item_price = 0;
                let item_original_price = 0;
                let item_num = 0;
                const priceElement = itemElement.querySelector('div[class*="itemInfoColPrice"]');
                if (priceElement) {
                    const priceContainer = priceElement.querySelector('div[class*="trade-price-container"]');
                    if (priceContainer) {
                        const symbol = priceContainer.querySelector('.trade-price-symbol')?.textContent || '';
                        const integer = priceContainer.querySelector('.trade-price-integer')?.textContent || '';
                        const point = priceContainer.querySelector('.trade-price-point')?.textContent || '';
                        const decimal = priceContainer.querySelector('.trade-price-decimal')?.textContent || '';

                        item_price = parseFloat(`${integer}${point}${decimal}`).toFixed(2);
                        item_original_price = item_price;
                    }

                    const originalPriceContainer = priceElement.querySelector('div[class*="trade-price-container-underline"]');
                    if (originalPriceContainer) {
                        const symbol = originalPriceContainer.querySelector('.trade-price-symbol')?.textContent || '';
                        const integer = originalPriceContainer.querySelector('.trade-price-integer')?.textContent || '';
                        const point = originalPriceContainer.querySelector('.trade-price-point')?.textContent || '';
                        const decimal = originalPriceContainer.querySelector('.trade-price-decimal')?.textContent || '';

                        item_original_price = parseFloat(`${integer}${point}${decimal}`).toFixed(2);
                    }

                    const quantityElement = priceElement.querySelector('div[class*="quantity--"]');
                    if (quantityElement) {
                        item_num = quantityElement.textContent.slice(1);
                        item_num = parseInt(item_num, 10);
                    }
                }

                let item_image = '';
                const imageDiv = itemElement.querySelector('a[class*="image--"]');
                console.log(imageDiv)
                if (imageDiv && imageDiv.style.backgroundImage) {
                    const rawUrl = imageDiv.style.backgroundImage.slice(5, -2);
                    item_image = rawUrl.replace(/_\d+x\d+\.(jpg|jpeg|png|gif|webp).*/, '');
                }

                results.push({
                    shop_info, order_id, order_date, item_id, item_name, item_style,
                    item_price, item_num, item_original_price, item_image, item_url
                });

            } catch (e) {
                console.error('解析某个商品时出现意外错误:', e, itemCheckbox.closest('div[class*="order-info-container"]'));
            }
        });

        if (results.length > 0) {
            const jsonString = JSON.stringify(results, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `taobao_orders_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // --- 8. 绑定事件监听 ---
    startButton.addEventListener('click', activateTool);
    exportButton.addEventListener('click', exportSelectedOrders);

})();
