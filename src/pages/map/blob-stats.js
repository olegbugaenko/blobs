import {useState} from "react";

export const BlobStats = ({...totalStats}) => {

    const tabs = ['Demograhy', 'Activities', 'Map'];

    const [tab, setTab] = useState(tabs[0]);

    const tabsToProps = {
        [tabs[0]]: [
            {
                label: 'Total blobs',
                value: totalStats.totalBlobs
            },{
                label: 'Male/Female',
                value: `${totalStats.totalMale}/${totalStats.totalFemale}`
            },{
                label: 'Average Age',
                value: totalStats.averageAge
            },{
                label: 'Births/Deaths',
                value: `${totalStats.blobBorn}/${totalStats.blobDied}`
            },...(Object.entries(totalStats.blobDeathReasons || {}).map(([reason, amount]) => ({
                label: `Deaths: ${reason}`,
                value: `${amount}`
            })))
        ],
        [tabs[1]]: [
            ...(Object.entries(totalStats.activityTimes || {}).map(([key, amount]) => ({
                label: `Avg. ${key} time`,
                value: `${Math.round(amount)}`
            })))
        ],
        [tabs[2]]: [
            {
                label: 'Total food',
                value: totalStats.totalFood
            },{
                label: 'Eaten/grown',
                value: `${totalStats.foodEaten}/${totalStats.foodGrown}`
            }
        ],
    }

    return (<div className={'box heading'}>
        <div className={'tabs'}>
            {tabs.map(tabItem => (<div className={`tab-item ${tabItem === tab ? 'selected' : ''}`} onClick={() => setTab(tabItem)}>
                {tabItem}
            </div>))}
        </div>
        <div className={'content'}>
            {tabsToProps[tab].map(one => {
                return (<p>{one.label}: {one.value}</p>)
            })}
        </div>
    </div> )

}