# 规则引擎easyRules实践
## 技术选型

[从0到1：构建强大且易用的规则引擎 - 美团技术团队](https://tech.meituan.com/2017/06/09/maze-framework.html)

## easyRules简介

[Java规则引擎easy-rules详细介绍](https://juejin.cn/post/7048917724126248967#heading-0)

## 业务背景

应收账款回款冲销、融资回款冲销等回款业务，需要回滚还款计划表执行还款操作。但是，在执行还款操作的时候会根据还款时间节点以及是否逾期等有不同的还款规则，比如逾期了那肯定是先还罚息利息、没逾期就先还本金。

除了回款业务，每日计息根据是否逾期以及计息时间节点也有不同的规则，那么，为了解耦业务逻辑，提高规则扩展性与维护性就用规则引擎统一管理和执行上述规则。

## Code

- 封装Fact

    ```java
    public class RepaymentFacts {
        private double remainingPrincipal;
        private LocalDate entryDate;
        private List<RepaymentPlan> repaymentLists; // 还款计划
    
        // 构造函数 & Getter & Setter
    }
    ```

- 规则一：利息期提前还本金

    ```java
    @Rule(name = "Interest Period Principal Repayment")
    public class InterestPeriodRule {
    
        @Condition
        public boolean when(@Fact("facts") RepaymentFacts facts) {
            return isInInterestPeriod(facts.getEntryDate()) && facts.getRemainingAmount() > 0;
        }
    
        @Action
        public void then(@Fact("facts") RepaymentFacts facts) {
            // 执行利息期提前还本金的更新还款计划的逻辑
        }
    
        private boolean isInInterestPeriod(LocalDate date) {
            LocalDate start = LocalDate.of(2025, 4, 1);
            LocalDate end = LocalDate.of(2025, 4, 15);
            return !date.isBefore(start) && !date.isAfter(end);
        }
    }
    ```

- 规则二：本金逾期还款

    ```java
    @Rule(name = "Overdue Principal Repayment")
    public class OverduePrincipalRule {
    
        @Condition
        public boolean when(@Fact("facts") RepaymentFacts facts) {
            return isInPrincipalPeriod(facts.getEntryDate())
                    && facts.getTotalCharges() > facts.getRemainingAmount();
        }
    
        @Action
        public void then(@Fact("facts") RepaymentFacts facts) {
            // 执行利息期提前还本金的更新还款计划的逻辑
        }
    
        private boolean isInPrincipalPeriod(LocalDate date) {
            LocalDate start = LocalDate.of(2025, 4, 16);
            LocalDate end = LocalDate.of(2025, 4, 30);
            return !date.isBefore(start) && !date.isAfter(end);
        }
    }
    ```

- 规则三：本金期正常还款

- 运行规则引擎

    ```java
    public class RepaymentRuleEngine {
    
        public static void main(String[] args) {
            // 假设数据
            RepaymentFacts repaymentFacts = new RepaymentFacts(
                   // 省略构造
            );
    
            Facts facts = new Facts();
            facts.put("facts", repaymentFacts);
    
            Rules rules = new Rules();
            rules.register(new InterestPeriodRule());
            rules.register(new OverduePrincipalRule());
            rules.register(new NormalPrincipalRule());
    
            RulesEngineParameters parameters = new RulesEngineParameters()
                    .skipOnFirstAppliedRule(false); // 保证所有规则都尝试执行
            // 因为规则之间并不互斥，例如逾期还钱，可能一起还很多钱，那么走逾期的规则把逾期的钱还完还能走正常还钱的规则
    
            RulesEngine rulesEngine = new DefaultRulesEngine(parameters);
            rulesEngine.fire(rules, facts);
            
            repaymentPlanRepository.update(repaymentFacts.getPlans); // 操作完成后入库
        }
    }
    ```

![image.png](https://keith-knowledge-base.oss-cn-hongkong.aliyuncs.com/20260112194011685.png)